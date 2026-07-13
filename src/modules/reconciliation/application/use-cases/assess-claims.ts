import {
  ClaimAssessmentUpdate,
  ClaimReconciliationRepository
} from "../ports/claim-reconciliation-repository.js";
import { assessClaimCandidates } from "../../domain/assessment.js";

export interface AssessClaimsCommand {
  sourceDocumentId?: string;
}

export function createAssessClaimsUseCase(repository: ClaimReconciliationRepository) {
  return {
    async execute(command: AssessClaimsCommand = {}): Promise<{ assessed: number }> {
      const candidates = await repository.listAssessmentCandidates();
      const decisions = assessClaimCandidates(candidates);
      let assessed = 0;

      for (const decision of decisions) {
        const candidate = candidates.find((claim) => claim.id === decision.claimId);
        if (!candidate) {
          continue;
        }

        if (command.sourceDocumentId && candidate.sourceDocumentId !== command.sourceDocumentId) {
          const decisionTouchesRequestedSource = decisions.some((otherDecision) => {
            const otherCandidate = candidates.find((claim) => claim.id === otherDecision.claimId);
            return otherCandidate?.sourceDocumentId === command.sourceDocumentId;
          });
          if (!decisionTouchesRequestedSource) {
            continue;
          }
        }

        const update: ClaimAssessmentUpdate = {
          claimId: decision.claimId,
          status: decision.status,
          confidenceScore: decision.confidenceScore,
          conflictSeverity: decision.conflictSeverity,
          reviewReason: decision.reviewReason,
          transitionSource: decision.transitionSource
        };

        await repository.updateClaimAssessment(update);
        assessed += 1;
      }

      return { assessed };
    }
  };
}
