export type JobSourceType = "markdown" | "plain_text";
export type JobRequirementType =
  | "skill"
  | "technology"
  | "experience"
  | "responsibility"
  | "seniority"
  | "domain"
  | "education"
  | "language";
export type JobRequirementImportance = "required" | "preferred";
export type JobPkqlFilterField = "skill" | "technology" | "role" | "project" | "type" | "status";

export interface JobSourceLocation {
  startLine: number;
  endLine: number;
}

export interface JobDescription {
  id: string;
  sourceType: JobSourceType;
  sourcePath: string;
  rawContent: string;
  contentHash: string;
  title?: string;
  ingestedAt: Date;
}

export interface JobRequirement {
  id: string;
  jobDescriptionId: string;
  requirementType: JobRequirementType;
  importance: JobRequirementImportance;
  normalizedValue?: string;
  originalText: string;
  sourceExcerpt: string;
  sourceLocation: JobSourceLocation;
  sectionLabel?: string;
  inferred: boolean;
}

export interface JobDescriptionWithRequirements {
  job: JobDescription;
  requirements: JobRequirement[];
}

export interface JobAnalysisSourceReference {
  excerpt?: string;
  sourceLocation?: JobSourceLocation;
}

export interface JobAnalysisSignal {
  value: string;
  sourceReference?: JobAnalysisSourceReference;
}

export interface JobAnalysisDomainSignal {
  canonicalValue: string;
  sourceValue: string;
  sourceReference?: JobAnalysisSourceReference;
}

export type JobAnalysisSeniorityLevel =
  | "entry"
  | "junior"
  | "mid"
  | "senior"
  | "staff"
  | "principal"
  | "lead"
  | "manager"
  | "director"
  | "executive";

export type JobAnalysisSenioritySignalType = "title" | "requirement" | "explicit-wording" | "legacy-unclassified";

export interface JobAnalysisSenioritySignal {
  canonicalLevel: JobAnalysisSeniorityLevel;
  sourceValue: string;
  signalType: JobAnalysisSenioritySignalType;
  sourceReference?: JobAnalysisSourceReference;
}

export interface JobAnalysisInferredRequirement extends JobAnalysisSignal {
  id: string;
  inferred: true;
  importance: JobRequirementImportance;
}

export interface JobAnalysisContent {
  inferredRequirements: JobAnalysisInferredRequirement[];
  senioritySignals: JobAnalysisSenioritySignal[];
  domainSignals: JobAnalysisDomainSignal[];
  crossTeamCollaborationSignals: JobAnalysisSignal[];
  crossTeamLeadershipSignals: JobAnalysisSignal[];
  architectureAndReliabilityExpectations: JobAnalysisSignal[];
  ambiguities: string[];
  warnings: string[];
}

export interface JobAnalysis extends JobAnalysisContent {
  id: string;
  jobDescriptionId: string;
  provider: string;
  model: string;
  promptVersion: string;
  analysisIdentity?: string;
  createdAt: Date;
}

export interface JobPkqlFilter {
  field: JobPkqlFilterField;
  value: string;
  sourceRequirementIds: string[];
}

export interface JobRetrievalIntent {
  jobDescriptionId: string;
  sourceRequirementIds: string[];
  inferredRequirementIds: string[];
  inferredAnalysisRequirementIds: string[];
  analysisId?: string;
  filters: JobPkqlFilter[];
  query: string;
  semanticText: string;
  warnings: string[];
}

export type CoverageStatus = "strong" | "partial" | "weak" | "missing";
export type ExaggerationRisk = "low" | "medium" | "high";
export type EvidenceRejectionReason =
  | "irrelevant"
  | "weak"
  | "redundant"
  | "unsupported_scope"
  | "lower_quality_alternative"
  | "insufficient_provenance";

export interface CandidateEvidenceSource {
  sourceDocumentId: string;
  sourceReferenceId?: string;
  locator?: string;
  excerpt: string;
  sourcePath?: string;
  sourceLanguage?: string;
  originalSectionLabel?: string;
}

export interface CandidateEvidenceObjectiveSignals {
  confidenceScore: number;
  finalScore: number;
  semanticScore?: number;
  structuredScore?: number;
  retrievalStrategies: string[];
}

export interface CandidateEvidence {
  evidenceClaimId: string;
  knowledgeAssetId: string;
  subjectAssetId?: string;
  subjectType: string;
  claimType?: string;
  claimCategory?: string;
  predicate?: string;
  claimText: string;
  relatedAssetId?: string;
  valueText?: string;
  valueUnit?: string;
  claimStatus?: string;
  sources: CandidateEvidenceSource[];
  objectiveSignals: CandidateEvidenceObjectiveSignals;
}

export interface CandidateRequirementEvidence {
  requirementId: string;
  requirementText: string;
  requirementType: JobRequirementType;
  importance: JobRequirementImportance;
  candidates: CandidateEvidence[];
  diagnostics: RequirementCandidatePipelineDiagnostics;
}

export type CandidatePipelineStage = "retrieval" | "eligibility" | "hydration" | "association";
export type CandidateDiscardReason =
  | "canonical_claim_not_found"
  | "canonical_identity_mismatch"
  | "unsupported_legacy_record"
  | "ineligible_claim_status"
  | "duplicate_requirement_candidate"
  | "asset_only_retrieval_result"
  | "retrieval_projection_ineligible";

export interface DiscardedCandidateResult {
  stage: CandidatePipelineStage;
  reasonCode: CandidateDiscardReason;
  reason: string;
  evidenceClaimId?: string;
  knowledgeAssetId?: string;
  retrievalStrategies?: string[];
  semanticScore?: number;
  structuredScore?: number;
  finalScore?: number;
}

export interface RequirementCandidatePipelineDiagnostics {
  retrievalIntent: string;
  rawRetrievalResultCount: number;
  eligibleResultCount: number;
  canonicalHydrationCount: number;
  requirementAssociationCount: number;
  discardedResults: DiscardedCandidateResult[];
}

export interface CandidateEvidencePack {
  version: string;
  hash: string;
  jobDescriptionId: string;
  jobAnalysisId?: string;
  generatedAt: Date;
  requirements: CandidateRequirementEvidence[];
  warnings: string[];
}

export interface EvidenceSelection {
  evidenceClaimId: string;
  reason: string;
  contribution: string;
  complementaryEvidenceIds?: string[];
  exaggerationRisk: ExaggerationRisk;
  evidence: CandidateEvidence;
}

export interface EvidenceRejection {
  evidenceClaimId: string;
  reason: EvidenceRejectionReason;
  explanation: string;
  evidence: CandidateEvidence;
}

export interface RequirementCoverage {
  requirementId: string;
  requirementText: string;
  importance: JobRequirementImportance;
  coverageStatus: CoverageStatus;
  selectedEvidenceIds: string[];
  rejectedCandidateEvidenceIds: string[];
  selections: EvidenceSelection[];
  rejections: EvidenceRejection[];
  strengthFactors: string[];
  limitations: string[];
  explanation: string;
}

export interface MissingEvidence {
  requirementId: string;
  requirementText: string;
  reason: string;
}

export interface CuratedEvidencePack {
  id: string;
  runIdentity: string;
  jobDescriptionId: string;
  jobAnalysisId?: string;
  candidatePackVersion: string;
  candidatePackHash: string;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: Date;
  overallCoverageSummary: string;
  requirementCoverage: RequirementCoverage[];
  recommendedEvidence: EvidenceSelection[];
  discardedEvidence: EvidenceRejection[];
  missingEvidence: MissingEvidence[];
  warnings: string[];
  limitations: string[];
  displayScore?: number;
}
