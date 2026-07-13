import { ConflictSeverity, EvidenceClaim } from "./model.js";

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

export interface AssessableClaim extends EvidenceClaim {
  sourceDocumentId: string;
  sourceReliability: number;
  structured: StructuredClaimFields;
}

export interface ClaimSignature {
  key: string;
  value: string;
  conflictSeverity: ConflictSeverity;
}

export interface ClaimAssessmentDecision {
  claimId: string;
  status: "confirmed" | "single_source" | "needs_review";
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewReason?: string;
}

const severityRank: Record<ConflictSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};

export function normalizeClaimValue(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

export function buildClaimSignature(claim: AssessableClaim): ClaimSignature {
  const structured = claim.structured;

  if (claim.claimType === "skill" && structured.skillName) {
    return {
      key: `skill:${normalizeClaimValue(structured.skillName)}`,
      value: normalizeClaimValue(structured.skillCategory) || "present",
      conflictSeverity: "low"
    };
  }

  if (claim.claimType === "experience" && structured.experienceRole) {
    return {
      key: [
        "experience",
        normalizeClaimValue(structured.experienceRole),
        normalizeClaimValue(structured.experienceOrganization) || "unknown-organization"
      ].join(":"),
      value: [
        `start=${normalizeClaimValue(structured.experienceStartDate) || "unknown"}`,
        `end=${normalizeClaimValue(structured.experienceEndDate) || "unknown"}`
      ].join("|"),
      conflictSeverity: "high"
    };
  }

  if (claim.claimType === "project" && structured.projectName) {
    return {
      key: `project:${normalizeClaimValue(structured.projectName)}`,
      value: normalizeClaimValue(structured.projectDescription) || "present",
      conflictSeverity: "low"
    };
  }

  if (claim.claimType === "achievement" && structured.achievementTitle) {
    return {
      key: `achievement:${normalizeClaimValue(structured.achievementTitle)}`,
      value: normalizeClaimValue(structured.achievementDescription) || "present",
      conflictSeverity: "low"
    };
  }

  return {
    key: `${claim.claimType}:${normalizeClaimValue(claim.claimText)}`,
    value: "present",
    conflictSeverity: "none"
  };
}

export function assessClaimCandidates(candidates: AssessableClaim[]): ClaimAssessmentDecision[] {
  const groups = new Map<string, Array<{ claim: AssessableClaim; signature: ClaimSignature }>>();

  for (const claim of candidates) {
    const signature = buildClaimSignature(claim);
    const group = groups.get(signature.key) ?? [];
    group.push({ claim, signature });
    groups.set(signature.key, group);
  }

  const decisions: ClaimAssessmentDecision[] = [];

  for (const group of groups.values()) {
    const values = new Set(group.map((item) => item.signature.value));
    const sourceDocuments = new Set(group.map((item) => item.claim.sourceDocumentId));
    const hasConflict = values.size > 1;
    const conflictSeverity = highestSeverity(group.map((item) => item.signature.conflictSeverity));
    const conflictReason = hasConflict
      ? `Conflicting ${group[0].claim.claimType} evidence for "${group[0].signature.key}".`
      : undefined;

    for (const item of group) {
      if (isUserReviewed(item.claim)) {
        continue;
      }

      if (hasConflict) {
        decisions.push({
          claimId: item.claim.id,
          status: "needs_review",
          confidenceScore: adjustedConfidence(item.claim.sourceReliability, conflictSeverity),
          conflictSeverity,
          reviewReason: conflictReason
        });
        continue;
      }

      if (sourceDocuments.size > 1) {
        decisions.push({
          claimId: item.claim.id,
          status: "confirmed",
          confidenceScore: Math.min(100, item.claim.sourceReliability + 20),
          conflictSeverity: "none",
          reviewReason: "Compatible evidence appears in multiple sources."
        });
        continue;
      }

      decisions.push({
        claimId: item.claim.id,
        status: "single_source",
        confidenceScore: item.claim.sourceReliability,
        conflictSeverity: "none",
        reviewReason: undefined
      });
    }
  }

  return decisions;
}

function isUserReviewed(claim: AssessableClaim): boolean {
  return claim.reviewedAt !== undefined && ["confirmed", "rejected", "superseded"].includes(claim.status);
}

function adjustedConfidence(sourceReliability: number, conflictSeverity: ConflictSeverity): number {
  const penalty = {
    none: 0,
    low: 10,
    medium: 25,
    high: 40
  }[conflictSeverity];

  return Math.max(0, sourceReliability - penalty);
}

function highestSeverity(severities: ConflictSeverity[]): ConflictSeverity {
  return severities.reduce<ConflictSeverity>((highest, severity) => (
    severityRank[severity] > severityRank[highest] ? severity : highest
  ), "none");
}
