export const evaluationStages = ["retrieval", "candidate_association", "reasoning"] as const
export type EvaluationStage = typeof evaluationStages[number]

export type EvaluationRunStatus = "passed" | "failed" | "errored"
export type EvaluationStageStatus = "passed" | "failed" | "errored" | "blocked"
export type EvaluationCoverageStatus = "missing" | "weak" | "partial" | "strong"
export type EvaluationClaimStatus = "confirmed" | "single_source" | "needs_review" | "rejected" | "superseded"

export interface EvaluationSourceFixture {
  sourceDocumentId: string
  sourceReferenceId?: string
  locator?: string
  excerpt: string
}

export interface EvaluationEvidenceFixture {
  id: string
  knowledgeAssetId: string
  claimText: string
  claimStatus: EvaluationClaimStatus
  confidenceScore: number
  structuredScore?: number
  semanticScore?: number
  tags: string[]
  requirementIds: string[]
  sources: EvaluationSourceFixture[]
}

export interface EvaluationRequirementFixture {
  id: string
  text: string
  type: "skill" | "technology" | "experience" | "responsibility" | "seniority" | "domain" | "education" | "language"
  importance: "required" | "preferred"
  query: string
}

interface EvaluationExpectationBase {
  id: string
  stage: EvaluationStage
}

export type EvaluationExpectation =
  | (EvaluationExpectationBase & { type: "expected_evidence_ids"; evidenceIds: string[]; k?: number })
  | (EvaluationExpectationBase & { type: "forbidden_evidence_ids"; evidenceIds: string[] })
  | (EvaluationExpectationBase & { type: "top_k_evidence"; evidenceIds: string[]; k: number })
  | (EvaluationExpectationBase & { type: "maximum_evidence_count"; maximum: number })
  | (EvaluationExpectationBase & { type: "coverage_range"; requirementId: string; minimum?: EvaluationCoverageStatus; maximum?: EvaluationCoverageStatus })
  | (EvaluationExpectationBase & { type: "expected_missing_requirements"; requirementIds: string[] })
  | (EvaluationExpectationBase & { type: "required_provenance"; evidenceIds?: string[]; fields: Array<"sourceDocumentId" | "sourceReferenceId" | "locator"> })
  | (EvaluationExpectationBase & { type: "candidate_membership" })
  | (EvaluationExpectationBase & { type: "no_fabricated_evidence" })
  | (EvaluationExpectationBase & { type: "schema_validity"; valid: boolean })

export interface EvaluationReasoningFixture {
  provider: string
  model: string
  promptVersion: string
  coverage: Array<{
    requirementId: string
    coverageStatus: EvaluationCoverageStatus
    selectedEvidenceIds: string[]
    rejectedEvidenceIds: string[]
  }>
  promptTokens?: number
  completionTokens?: number
}

export interface EvaluationScenario {
  id: string
  description: string
  requirements: EvaluationRequirementFixture[]
  evidence: EvaluationEvidenceFixture[]
  expectations: EvaluationExpectation[]
  reasoning?: EvaluationReasoningFixture
  skipStages?: EvaluationStage[]
}

export interface EvaluationDataset {
  schemaVersion: string
  id: string
  version: string
  hash: string
  scenarios: EvaluationScenario[]
}

export interface EvaluationEvidenceObservation {
  evidenceId: string
  requirementId?: string
  sources: EvaluationSourceFixture[]
}

export interface EvaluationCoverageObservation {
  requirementId: string
  coverageStatus: EvaluationCoverageStatus
  selectedEvidenceIds: string[]
  rejectedEvidenceIds: string[]
}

export interface EvaluationStageObservation {
  evidence: EvaluationEvidenceObservation[]
  candidateEvidenceIdsByRequirement: Record<string, string[]>
  coverage: EvaluationCoverageObservation[]
  schemaValid: boolean
}

export interface EvaluationExecutionMetadata {
  provider?: string
  model?: string
  promptVersion?: string
  candidatePackVersion?: string
  durationMs: number
  promptTokens?: number
  completionTokens?: number
}

export interface EvaluationStageExecution {
  stage: EvaluationStage
  observation?: EvaluationStageObservation
  metadata: EvaluationExecutionMetadata
  error?: { code: string; message: string }
}

export interface EvaluationAssertionResult {
  expectationId: string
  stage: EvaluationStage
  type: EvaluationExpectation["type"]
  passed: boolean
  reasonCode: string
  expected?: unknown
  observed?: unknown
}

export interface EvaluationResult {
  scenarioId: string
  stage: EvaluationStage
  status: EvaluationStageStatus
  assertions: EvaluationAssertionResult[]
  metadata: EvaluationExecutionMetadata
  observation?: EvaluationStageObservation
  diagnostic?: { code: string; message: string }
}

export type EvaluationMetricValue =
  | { status: "value"; value: number; numerator: number; denominator: number }
  | { status: "not_applicable" }

export interface EvaluationQualityMetrics {
  evidencePrecisionAtK: EvaluationMetricValue
  evidenceRecallAtK: EvaluationMetricValue
  requirementCoverageAccuracy: EvaluationMetricValue
  missingEvidenceAccuracy: EvaluationMetricValue
  unsupportedSelectionRate: EvaluationMetricValue
  provenanceCompleteness: EvaluationMetricValue
  schemaValidationSuccessRate: EvaluationMetricValue
}

export interface EvaluationPerformanceMetrics {
  averageReasoningLatencyMs?: number
  promptTokens?: { total: number; average: number; samples: number }
  completionTokens?: { total: number; average: number; samples: number }
}

export interface EvaluationVersionMetadata {
  datasetId: string
  datasetVersion: string
  datasetHash: string
  gitSha: string
  provider?: string
  model?: string
  promptVersion?: string
  candidatePackVersions: string[]
}

export interface EvaluationRun {
  reportSchemaVersion: string
  id: string
  status: EvaluationRunStatus
  requestedScenarioId?: string
  startedAt: Date
  completedAt: Date
  versions: EvaluationVersionMetadata
  results: EvaluationResult[]
  qualityMetrics: EvaluationQualityMetrics
  performanceMetrics: EvaluationPerformanceMetrics
}

export interface EvaluationReport {
  run: EvaluationRun
  counts: Record<EvaluationStageStatus, number>
}
