import {
  ConflictSeverity,
  EvidenceClaimStatus,
  ClaimStatusTransitionSource,
  EvidenceClaim
} from "../../domain/model.js";
import { AssessableClaim } from "../../domain/trust.js";

export interface ClaimAssessmentCandidate extends AssessableClaim {
  sourcePath: string;
  sourceReferenceSection: string;
  sourceReferenceLocator: string;
  sourceReferenceExcerpt: string;
}

export interface ClaimAssessmentUpdate {
  claimId: string;
  status: EvidenceClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewReason?: string;
  transitionSource: ClaimStatusTransitionSource;
}

export interface ClaimReviewItem {
  id: string;
  status: EvidenceClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewReason?: string;
  claimType: EvidenceClaim["claimType"];
  claimText: string;
  sourcePath: string;
  sourceReferenceSection: string;
  sourceReferenceLocator: string;
  sourceReferenceExcerpt: string;
}

export interface ClaimStatusTransition {
  claimId: string;
  nextStatus: EvidenceClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reason: string;
  transitionSource: ClaimStatusTransitionSource;
  reviewedAt?: Date;
}

export interface TrustedClaimRepository {
  listAssessmentCandidates(): Promise<ClaimAssessmentCandidate[]>;
  updateClaimAssessment(update: ClaimAssessmentUpdate): Promise<void>;
  listClaimsRequiringReview(): Promise<ClaimReviewItem[]>;
  transitionClaimStatus(transition: ClaimStatusTransition): Promise<void>;
}
