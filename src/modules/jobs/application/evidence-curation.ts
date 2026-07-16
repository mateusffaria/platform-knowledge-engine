import {
  CandidateEvidencePack,
  CoverageStatus,
  CuratedEvidencePack,
  EvidenceRejection,
  RequirementCoverage
} from "../domain/model.js";

const coverageRank: Record<CoverageStatus, number> = { missing: 0, weak: 1, partial: 2, strong: 3 };

export function missingCoverage(requirement: CandidateEvidencePack["requirements"][number]): RequirementCoverage {
  return {
    requirementId: requirement.requirementId,
    requirementText: requirement.requirementText,
    importance: requirement.importance,
    coverageStatus: "missing",
    selectedEvidenceIds: [],
    rejectedCandidateEvidenceIds: [],
    selections: [],
    rejections: [],
    strengthFactors: [],
    limitations: ["No eligible canonical evidence was supplied for this requirement."],
    explanation: "No eligible canonical evidence was supplied; coverage cannot be established."
  };
}

export function displayScore(coverage: RequirementCoverage[]): number | undefined {
  if (coverage.length === 0) {
    return undefined;
  }
  const weighted = coverage.reduce((total, entry) => total + coverageRank[entry.coverageStatus] * (entry.importance === "required" ? 2 : 1), 0);
  const maximum = coverage.reduce((total, entry) => total + 3 * (entry.importance === "required" ? 2 : 1), 0);
  return Math.round((weighted / maximum) * 100);
}

function downgrade(status: CoverageStatus): CoverageStatus {
  return status === "strong" ? "partial" : status === "partial" ? "weak" : status;
}

export function deduplicateCrossRequirementSelections(coverage: RequirementCoverage[]): RequirementCoverage[] {
  const firstByClaim = new Map<string, RequirementCoverage>();
  const sorted = [...coverage].sort((left, right) => {
    const importance = Number(right.importance === "required") - Number(left.importance === "required");
    return importance || left.requirementId.localeCompare(right.requirementId);
  });
  for (const entry of sorted) {
    for (const selection of [...entry.selections]) {
      const existing = firstByClaim.get(selection.evidenceClaimId);
      if (!existing) {
        firstByClaim.set(selection.evidenceClaimId, entry);
        continue;
      }
      const distinctContribution = selection.contribution.trim().toLocaleLowerCase() !== existing.selections
        .find((candidate) => candidate.evidenceClaimId === selection.evidenceClaimId)?.contribution.trim().toLocaleLowerCase();
      if (distinctContribution && existing.selections.length > 1 && entry.selections.length > 1) {
        continue;
      }
      entry.selections = entry.selections.filter((candidate) => candidate.evidenceClaimId !== selection.evidenceClaimId);
      entry.selectedEvidenceIds = entry.selections.map((candidate) => candidate.evidenceClaimId);
      const rejection: EvidenceRejection = {
        evidenceClaimId: selection.evidenceClaimId,
        reason: "redundant",
        explanation: "This canonical claim was retained for another requirement where it provides the preferred direct support.",
        evidence: selection.evidence
      };
      entry.rejections.push(rejection);
      entry.rejectedCandidateEvidenceIds = [...new Set([...entry.rejectedCandidateEvidenceIds, rejection.evidenceClaimId])];
      entry.limitations = [...entry.limitations, "A redundant cross-requirement selection was removed."];
      entry.coverageStatus = entry.selections.length === 0 ? "missing" : downgrade(entry.coverageStatus);
    }
  }
  return coverage;
}

export function finalizeCuratedEvidencePack(pack: CuratedEvidencePack): CuratedEvidencePack {
  const requirementCoverage = deduplicateCrossRequirementSelections(pack.requirementCoverage);
  return {
    ...pack,
    requirementCoverage,
    recommendedEvidence: requirementCoverage.flatMap((entry) => entry.selections),
    discardedEvidence: requirementCoverage.flatMap((entry) => entry.rejections),
    missingEvidence: requirementCoverage.filter((entry) => entry.coverageStatus === "missing").map((entry) => ({
      requirementId: entry.requirementId,
      requirementText: entry.requirementText,
      reason: entry.limitations[0] ?? "No sufficient eligible evidence was selected."
    })),
    displayScore: displayScore(requirementCoverage)
  };
}
