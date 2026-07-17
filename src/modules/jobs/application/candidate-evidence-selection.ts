import {
  CandidateEvidence,
  CandidateSelectionConfig,
  CandidateSelectionExclusion
} from "../domain/model.js";

export const defaultCandidateSelectionConfig: CandidateSelectionConfig = {
  limitPerRequirement: 3
};

export function compareCandidateEvidence(left: CandidateEvidence, right: CandidateEvidence): number {
  if (right.objectiveSignals.finalScore !== left.objectiveSignals.finalScore) {
    return right.objectiveSignals.finalScore - left.objectiveSignals.finalScore;
  }

  return left.evidenceClaimId.localeCompare(right.evidenceClaimId);
}

export function isExactStructuredMatch(candidate: CandidateEvidence): boolean {
  return (candidate.objectiveSignals.structuredScore ?? 0) >= 1;
}

export function selectCandidatesForReasoner(
  candidates: CandidateEvidence[],
  selection: CandidateSelectionConfig
): { reasonerCandidateIds: string[]; selectionExclusions: CandidateSelectionExclusion[] } {
  const ranked = [...candidates].sort(compareCandidateEvidence);
  const exactStructured = ranked.filter(isExactStructuredMatch);
  const nonExact = ranked.filter((candidate) => !isExactStructuredMatch(candidate));
  const scoreEligible = nonExact.filter((candidate) => (
    selection.minCandidateScore === undefined || candidate.objectiveSignals.finalScore >= selection.minCandidateScore
  ));
  const selectedNonExact = scoreEligible.slice(0, selection.limitPerRequirement);
  const selectedIds = new Set([...exactStructured, ...selectedNonExact].map((candidate) => candidate.evidenceClaimId));
  const selectionExclusions = ranked.flatMap((candidate): CandidateSelectionExclusion[] => {
    if (selectedIds.has(candidate.evidenceClaimId)) {
      return [];
    }
    const finalScore = candidate.objectiveSignals.finalScore;
    if (selection.minCandidateScore !== undefined && finalScore < selection.minCandidateScore) {
      return [{
        evidenceClaimId: candidate.evidenceClaimId,
        reasonCode: "minimum_candidate_score_not_met",
        reason: `Final score ${finalScore} is below requested minimum candidate score ${selection.minCandidateScore}.`,
        finalScore
      }];
    }
    return [{
      evidenceClaimId: candidate.evidenceClaimId,
      reasonCode: "limit_per_requirement",
      reason: `Candidate was outside the configured non-exact limit of ${selection.limitPerRequirement} per requirement.`,
      finalScore
    }];
  });

  return {
    reasonerCandidateIds: ranked
      .filter((candidate) => selectedIds.has(candidate.evidenceClaimId))
      .map((candidate) => candidate.evidenceClaimId),
    selectionExclusions
  };
}
