import { describe, expect, it } from "vitest"

import { assertExpectation } from "../src/modules/evaluation/application/assertions.js"
import { aggregatePerformanceMetrics, aggregateQualityMetrics } from "../src/modules/evaluation/application/metrics.js"
import { EvaluationResult, EvaluationScenario, EvaluationStageObservation } from "../src/modules/evaluation/domain/model.js"

const observation: EvaluationStageObservation = {
  evidence: [
    { evidenceId: "a", requirementId: "r1", sources: [{ sourceDocumentId: "doc", sourceReferenceId: "ref", locator: "line:1", excerpt: "safe" }] },
    { evidenceId: "b", requirementId: "r1", sources: [] }
  ],
  candidateEvidenceIdsByRequirement: { r1: ["a", "b"], r2: [] },
  coverage: [
    { requirementId: "r1", coverageStatus: "partial", selectedEvidenceIds: ["a"], rejectedEvidenceIds: ["b"] },
    { requirementId: "r2", coverageStatus: "missing", selectedEvidenceIds: [], rejectedEvidenceIds: [] }
  ],
  schemaValid: true
}

function expectation(input: any) { return { id: `expect-${input.type}`, stage: "reasoning", ...input } as const }

describe("evaluation assertions", () => {
  it("supports every deterministic expectation and stable coverage ordering", () => {
    expect(assertExpectation(expectation({ type: "expected_evidence_ids", evidenceIds: ["a"] }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "forbidden_evidence_ids", evidenceIds: ["b"] }), observation).reasonCode).toBe("forbidden_evidence_present")
    expect(assertExpectation(expectation({ type: "top_k_evidence", evidenceIds: ["a"], k: 1 }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "maximum_evidence_count", maximum: 1 }), observation).reasonCode).toBe("maximum_evidence_count_exceeded")
    expect(assertExpectation(expectation({ type: "coverage_range", requirementId: "r1", minimum: "weak", maximum: "strong" }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "coverage_range", requirementId: "r1", minimum: "strong" }), observation).reasonCode).toBe("coverage_out_of_range")
    expect(assertExpectation(expectation({ type: "expected_missing_requirements", requirementIds: ["r2"] }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "required_provenance", evidenceIds: ["a"], fields: ["sourceDocumentId", "sourceReferenceId", "locator"] }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "candidate_membership" }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "no_fabricated_evidence" }), observation).passed).toBe(true)
    expect(assertExpectation(expectation({ type: "schema_validity", valid: true }), observation).passed).toBe(true)
  })

  it("detects fabricated and cross-requirement selections without retaining content", () => {
    const changed = structuredClone(observation)
    changed.coverage[0].selectedEvidenceIds = ["unknown"]
    expect(assertExpectation(expectation({ type: "no_fabricated_evidence" }), changed)).toMatchObject({ passed: false, reasonCode: "fabricated_evidence", observed: ["unknown"] })
    changed.candidateEvidenceIdsByRequirement.r2 = ["a"]
    changed.coverage[1].selectedEvidenceIds = ["b"]
    expect(assertExpectation(expectation({ type: "candidate_membership" }), changed)).toMatchObject({ passed: false, reasonCode: "unsupported_selection" })
  })
})

describe("evaluation metrics", () => {
  it("uses exact denominators and keeps quality separate from performance", () => {
    const scenario: EvaluationScenario = {
      id: "scenario", description: "scenario", requirements: [], evidence: [],
      expectations: [
        { id: "expected", stage: "reasoning", type: "expected_evidence_ids", evidenceIds: ["a", "b", "c"], k: 2 },
        { id: "coverage", stage: "reasoning", type: "coverage_range", requirementId: "r1", minimum: "partial" },
        { id: "missing", stage: "reasoning", type: "expected_missing_requirements", requirementIds: ["r2"] },
        { id: "provenance", stage: "reasoning", type: "required_provenance", evidenceIds: ["a", "b"], fields: ["sourceReferenceId"] }
      ]
    }
    const result: EvaluationResult = { scenarioId: "scenario", stage: "reasoning", status: "passed", observation, metadata: { durationMs: 20, promptTokens: 10 }, assertions: [
      { expectationId: "coverage", stage: "reasoning", type: "coverage_range", passed: true, reasonCode: "expectation_satisfied" }
    ] }
    const quality = aggregateQualityMetrics([scenario], [result])
    expect(quality.evidencePrecisionAtK).toMatchObject({ status: "value", numerator: 2, denominator: 2, value: 1 })
    expect(quality.evidenceRecallAtK).toMatchObject({ status: "value", numerator: 2, denominator: 3, value: 2 / 3 })
    expect(quality.missingEvidenceAccuracy).toMatchObject({ value: 1 })
    expect(quality.provenanceCompleteness).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 })
    expect(aggregatePerformanceMetrics([result])).toEqual({ averageReasoningLatencyMs: 20, promptTokens: { total: 10, average: 10, samples: 1 }, completionTokens: undefined })
  })

  it("reports not applicable instead of zero for empty closed-world denominators", () => {
    const result: EvaluationResult = { scenarioId: "empty", stage: "reasoning", status: "passed", observation: { ...observation, evidence: [], candidateEvidenceIdsByRequirement: { r2: [] }, coverage: [observation.coverage[1]] }, metadata: { durationMs: 1 }, assertions: [] }
    const quality = aggregateQualityMetrics([{ id: "empty", description: "empty", requirements: [], evidence: [], expectations: [] }], [result])
    expect(quality.evidenceRecallAtK.status).toBe("not_applicable")
    expect(quality.unsupportedSelectionRate.status).toBe("not_applicable")
    expect(quality.provenanceCompleteness.status).toBe("not_applicable")
    expect(aggregatePerformanceMetrics([result]).promptTokens).toBeUndefined()
  })
})
