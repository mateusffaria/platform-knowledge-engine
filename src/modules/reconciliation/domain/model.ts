export type ClaimType = "skill" | "experience" | "project" | "achievement";
export type ClaimCategory = "fact" | "responsibility" | "achievement" | "metric" | "capability" | "relationship";
export type ClaimPredicate =
  | "works_at"
  | "holds_role"
  | "uses_technology"
  | "participated_in"
  | "occurred_during"
  | "reduced_processing_time"
  | "reduced_cost"
  | "improved_reliability"
  | "demonstrates";
export type ClaimStatus = "confirmed" | "single_source" | "needs_review" | "rejected" | "superseded";
export type ConflictSeverity = "none" | "low" | "medium" | "high";
export type ClaimStatusTransitionSource = "system" | "user";

export interface StructuredClaimFields {
  skillName?: string;
  skillCategory?: string;
  experienceRole?: string;
  experienceOrganization?: string;
  experienceStartDate?: string;
  experienceEndDate?: string;
  projectName?: string;
  projectDescription?: string;
  achievementTitle?: string;
  achievementDescription?: string;
}

export interface AssessableClaim {
  id: string;
  knowledgeAssetId: string;
  subjectAssetId: string;
  sourceReferenceId: string;
  claimType: ClaimType;
  claimCategory: ClaimCategory;
  predicate: ClaimPredicate;
  claimText: string;
  relatedAssetId?: string;
  valueText?: string;
  valueUnit?: string;
  sourceLanguage?: string;
  originalSectionLabel: string;
  status: ClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewedAt?: Date;
  reviewReason?: string;
  sourceDocumentId: string;
  sourceReliability: number;
  structured: StructuredClaimFields;
}

export interface ClaimSignature {
  key: string;
  value: string;
  conflictSeverity: ConflictSeverity;
}

export interface Conflict {
  claimIds: string[];
  normalizedSubject: string;
  incompatibleValues: string[];
  severity: ConflictSeverity;
}

export interface ClaimAssessment {
  claimId: string;
  status: ClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewReason?: string;
  transitionSource: ClaimStatusTransitionSource;
}

export interface ReconciliationResult {
  assessments: ClaimAssessment[];
  conflicts: Conflict[];
}
