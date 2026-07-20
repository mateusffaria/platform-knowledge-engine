import {
  EvaluationAssertionResult,
  EvaluationCoverageStatus,
  EvaluationExpectation,
  EvaluationScenario,
  EvaluationStageObservation
} from "../domain/model.js"

const coverageRank: Record<EvaluationCoverageStatus, number> = { missing: 0, weak: 1, partial: 2, strong: 3 }

function unique(values: string[]): string[] { return [...new Set(values)] }

function observedEvidenceIds(observation: EvaluationStageObservation): string[] {
  return unique(observation.evidence.map((item) => item.evidenceId))
}

function result(expectation: EvaluationExpectation, passed: boolean, reasonCode: string, expected?: unknown, observed?: unknown): EvaluationAssertionResult {
  return { expectationId: expectation.id, stage: expectation.stage, type: expectation.type, passed, reasonCode, expected, observed }
}

function provenancePresent(observation: EvaluationStageObservation, evidenceId: string, fields: Array<"sourceDocumentId" | "sourceReferenceId" | "locator">): boolean {
  const evidence = observation.evidence.find((item) => item.evidenceId === evidenceId)
  return Boolean(evidence?.sources.length) && evidence!.sources.every((source) => fields.every((field) => typeof source[field] === "string" && source[field]!.length > 0))
}

export function assertExpectation(expectation: EvaluationExpectation, observation: EvaluationStageObservation): EvaluationAssertionResult {
  const evidenceIds = observedEvidenceIds(observation)
  switch (expectation.type) {
    case "expected_evidence_ids": {
      const scope = expectation.k ? evidenceIds.slice(0, expectation.k) : evidenceIds
      const missing = expectation.evidenceIds.filter((id) => !scope.includes(id))
      return result(expectation, missing.length === 0, missing.length ? "expected_evidence_missing" : "expectation_satisfied", expectation.evidenceIds, scope)
    }
    case "forbidden_evidence_ids": {
      const present = expectation.evidenceIds.filter((id) => evidenceIds.includes(id))
      return result(expectation, present.length === 0, present.length ? "forbidden_evidence_present" : "expectation_satisfied", expectation.evidenceIds, present)
    }
    case "top_k_evidence": {
      const top = evidenceIds.slice(0, expectation.k)
      const missing = expectation.evidenceIds.filter((id) => !top.includes(id))
      return result(expectation, missing.length === 0, missing.length ? "top_k_evidence_missing" : "expectation_satisfied", { evidenceIds: expectation.evidenceIds, k: expectation.k }, top)
    }
    case "maximum_evidence_count":
      return result(expectation, evidenceIds.length <= expectation.maximum, evidenceIds.length <= expectation.maximum ? "expectation_satisfied" : "maximum_evidence_count_exceeded", expectation.maximum, evidenceIds.length)
    case "coverage_range": {
      const coverage = observation.coverage.find((item) => item.requirementId === expectation.requirementId)?.coverageStatus
      const passed = coverage !== undefined
        && (expectation.minimum === undefined || coverageRank[coverage] >= coverageRank[expectation.minimum])
        && (expectation.maximum === undefined || coverageRank[coverage] <= coverageRank[expectation.maximum])
      return result(expectation, passed, passed ? "expectation_satisfied" : coverage ? "coverage_out_of_range" : "coverage_missing", { minimum: expectation.minimum, maximum: expectation.maximum }, coverage)
    }
    case "expected_missing_requirements": {
      const observed = expectation.requirementIds.filter((requirementId) => {
        const coverage = observation.coverage.find((item) => item.requirementId === requirementId)
        return coverage?.coverageStatus === "missing" && coverage.selectedEvidenceIds.length === 0
      })
      return result(expectation, observed.length === expectation.requirementIds.length, observed.length === expectation.requirementIds.length ? "expectation_satisfied" : "expected_missing_requirement_not_missing", expectation.requirementIds, observed)
    }
    case "required_provenance": {
      const applicable = expectation.evidenceIds ?? evidenceIds
      const incomplete = applicable.filter((id) => evidenceIds.includes(id) && !provenancePresent(observation, id, expectation.fields))
      const absent = applicable.filter((id) => !evidenceIds.includes(id))
      const passed = incomplete.length === 0 && absent.length === 0
      return result(expectation, passed, passed ? "expectation_satisfied" : "required_provenance_missing", { evidenceIds: applicable, fields: expectation.fields }, { incomplete, absent })
    }
    case "candidate_membership": {
      const unsupported = observation.coverage.flatMap((coverage) => coverage.selectedEvidenceIds
        .filter((id) => !(observation.candidateEvidenceIdsByRequirement[coverage.requirementId] ?? []).includes(id))
        .map((evidenceId) => ({ requirementId: coverage.requirementId, evidenceId })))
      return result(expectation, unsupported.length === 0, unsupported.length ? "unsupported_selection" : "expectation_satisfied", "selected evidence belongs to requirement candidate scope", unsupported)
    }
    case "no_fabricated_evidence": {
      const candidates = new Set(Object.values(observation.candidateEvidenceIdsByRequirement).flat())
      const fabricated = observation.coverage.flatMap((coverage) => coverage.selectedEvidenceIds.filter((id) => !candidates.has(id)))
      return result(expectation, fabricated.length === 0, fabricated.length ? "fabricated_evidence" : "expectation_satisfied", "all selected IDs exist in the Candidate Evidence Pack", unique(fabricated))
    }
    case "schema_validity":
      return result(expectation, observation.schemaValid === expectation.valid, observation.schemaValid === expectation.valid ? "expectation_satisfied" : "schema_validity_mismatch", expectation.valid, observation.schemaValid)
    case "resume_plan_validity": {
      const issueCodes = [...new Set((observation.validationIssues ?? []).map((issue) => issue.code))].sort()
      const observedValid = observation.schemaValid && issueCodes.length === 0
      const requiredCodes = [...(expectation.issueCodes ?? [])].sort()
      const codesPresent = requiredCodes.every((code) => issueCodes.includes(code))
      const passed = observedValid === expectation.valid && codesPresent
      return result(expectation, passed, passed ? "expectation_satisfied" : "resume_plan_validity_mismatch", { valid: expectation.valid, issueCodes: requiredCodes }, { valid: observedValid, issueCodes })
    }
    case "resume_plan_identity_reuse":
      return result(expectation, observation.planIdentityStable === true, observation.planIdentityStable ? "expectation_satisfied" : "resume_plan_identity_changed", true, observation.planIdentityStable)
  }
}

export function assertStage(scenario: EvaluationScenario, stage: EvaluationExpectation["stage"], observation: EvaluationStageObservation): EvaluationAssertionResult[] {
  return scenario.expectations.filter((expectation) => expectation.stage === stage).map((expectation) => assertExpectation(expectation, observation))
}
