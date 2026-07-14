import {
  ClaimStatus,
  ClaimStatusTransitionSource,
  ClaimType,
  ConflictSeverity,
  AssessableClaim
} from "../../domain/model.js";

export interface ClaimAssessmentCandidate extends AssessableClaim {
  sourcePath: string;
  sourceReferenceSection: string;
  sourceReferenceLocator: string;
  sourceReferenceExcerpt: string;
}

export interface ClaimAssessmentUpdate {
  claimId: string;
  status: ClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewReason?: string;
  transitionSource: ClaimStatusTransitionSource;
}

export interface ClaimReviewItem {
  id: string;
  status: ClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewReason?: string;
  claimType: ClaimType;
  claimCategory: ClaimAssessmentCandidate["claimCategory"];
  predicate: ClaimAssessmentCandidate["predicate"];
  claimText: string;
  subjectAssetId: string;
  relatedAssetId?: string;
  valueText?: string;
  valueUnit?: string;
  sourceLanguage?: string;
  originalSectionLabel: string;
  sourcePath: string;
  sourceReferenceSection: string;
  sourceReferenceLocator: string;
  sourceReferenceExcerpt: string;
}

export interface ClaimStatusTransition {
  claimId: string;
  nextStatus: ClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reason: string;
  transitionSource: ClaimStatusTransitionSource;
  reviewedAt?: Date;
}

export interface ClaimReconciliationRepository {
  listAssessmentCandidates(): Promise<ClaimAssessmentCandidate[]>;
  updateClaimAssessment(update: ClaimAssessmentUpdate): Promise<void>;
  listClaimsRequiringReview(): Promise<ClaimReviewItem[]>;
  transitionClaimStatus(transition: ClaimStatusTransition): Promise<void>;
}
