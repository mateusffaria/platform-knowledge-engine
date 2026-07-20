import {
  EvaluationMetricValue,
  EvaluationPerformanceMetrics,
  EvaluationQualityMetrics,
  EvaluationResult,
  EvaluationScenario
} from "../domain/model.js"

function metric(numerator: number, denominator: number): EvaluationMetricValue {
  return denominator === 0 ? { status: "not_applicable" } : { status: "value", value: numerator / denominator, numerator, denominator }
}

function resultFor(results: EvaluationResult[], scenarioId: string, stage: EvaluationResult["stage"]): EvaluationResult | undefined {
  return results.find((result) => result.scenarioId === scenarioId && result.stage === stage)
}

export function aggregateQualityMetrics(scenarios: EvaluationScenario[], results: EvaluationResult[]): EvaluationQualityMetrics {
  let precisionCorrect = 0
  let precisionTotal = 0
  let recallCorrect = 0
  let recallTotal = 0
  let coverageCorrect = 0
  let coverageTotal = 0
  let missingCorrect = 0
  let missingTotal = 0
  let unsupported = 0
  let selections = 0
  let provenanceCorrect = 0
  let provenanceTotal = 0
  let schemasValid = 0
  let schemasAttempted = 0

  for (const scenario of scenarios) {
    for (const expectation of scenario.expectations) {
      const result = resultFor(results, scenario.id, expectation.stage)
      const observation = result?.observation
      if (!observation) continue
      const evidenceIds = [...new Set(observation.evidence.map((item) => item.evidenceId))]
      if (expectation.type === "expected_evidence_ids" || expectation.type === "top_k_evidence") {
        const k = expectation.type === "top_k_evidence" ? expectation.k : expectation.k ?? evidenceIds.length
        const observed = evidenceIds.slice(0, k)
        const correct = observed.filter((id) => expectation.evidenceIds.includes(id)).length
        precisionCorrect += correct
        precisionTotal += observed.length
        recallCorrect += correct
        recallTotal += expectation.evidenceIds.length
      }
      if (expectation.type === "coverage_range") {
        coverageTotal += 1
        if (result.assertions.find((assertion) => assertion.expectationId === expectation.id)?.passed) coverageCorrect += 1
      }
      if (expectation.type === "expected_missing_requirements") {
        for (const requirementId of expectation.requirementIds) {
          missingTotal += 1
          const coverage = observation.coverage.find((item) => item.requirementId === requirementId)
          if (coverage?.coverageStatus === "missing" && coverage.selectedEvidenceIds.length === 0) missingCorrect += 1
        }
      }
      if (expectation.type === "required_provenance") {
        const applicable = expectation.evidenceIds ?? evidenceIds
        for (const evidenceId of applicable) {
          const evidence = observation.evidence.find((item) => item.evidenceId === evidenceId)
          if (!evidence) continue
          provenanceTotal += 1
          if (evidence.sources.length > 0 && evidence.sources.every((source) => expectation.fields.every((field) => typeof source[field] === "string" && source[field]!.length > 0))) provenanceCorrect += 1
        }
      }
    }

    const reasoning = resultFor(results, scenario.id, "reasoning")?.observation
    if (reasoning) {
      const allCandidates = new Set(Object.values(reasoning.candidateEvidenceIdsByRequirement).flat())
      for (const coverage of reasoning.coverage) {
        for (const evidenceId of coverage.selectedEvidenceIds) {
          selections += 1
          if (!allCandidates.has(evidenceId) || !(reasoning.candidateEvidenceIdsByRequirement[coverage.requirementId] ?? []).includes(evidenceId)) unsupported += 1
        }
      }
    }
  }

  for (const result of results.filter((item) => item.status !== "blocked" && item.observation)) {
    schemasAttempted += 1
    if (result.observation?.schemaValid) schemasValid += 1
  }

  return {
    evidencePrecisionAtK: metric(precisionCorrect, precisionTotal),
    evidenceRecallAtK: metric(recallCorrect, recallTotal),
    requirementCoverageAccuracy: metric(coverageCorrect, coverageTotal),
    missingEvidenceAccuracy: metric(missingCorrect, missingTotal),
    unsupportedSelectionRate: metric(unsupported, selections),
    provenanceCompleteness: metric(provenanceCorrect, provenanceTotal),
    schemaValidationSuccessRate: metric(schemasValid, schemasAttempted)
  }
}

function tokenSummary(values: number[]): { total: number; average: number; samples: number } | undefined {
  if (values.length === 0) return undefined
  const total = values.reduce((sum, value) => sum + value, 0)
  return { total, average: total / values.length, samples: values.length }
}

export function aggregatePerformanceMetrics(results: EvaluationResult[]): EvaluationPerformanceMetrics {
  const reasoning = results.filter((item) => item.stage === "reasoning" && item.status !== "blocked")
  const latencies = reasoning.map((item) => item.metadata.durationMs)
  const promptTokens = reasoning.flatMap((item) => item.metadata.promptTokens === undefined ? [] : [item.metadata.promptTokens])
  const completionTokens = reasoning.flatMap((item) => item.metadata.completionTokens === undefined ? [] : [item.metadata.completionTokens])
  return {
    averageReasoningLatencyMs: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : undefined,
    promptTokens: tokenSummary(promptTokens),
    completionTokens: tokenSummary(completionTokens)
  }
}
