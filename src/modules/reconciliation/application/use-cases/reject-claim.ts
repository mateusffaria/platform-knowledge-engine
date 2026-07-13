import { ClaimEmbeddingCleanup } from "../ports/claim-embedding-cleanup.js";
import { ClaimReconciliationRepository } from "../ports/claim-reconciliation-repository.js";

export function createRejectClaimUseCase(
  repository: ClaimReconciliationRepository,
  embeddingCleanup?: ClaimEmbeddingCleanup
) {
  return {
    async execute(command: { claimId: string; reason: string }): Promise<{
      claimId: string;
      status: "rejected";
      removedEmbeddings: number;
    }> {
      const reason = command.reason.trim();
      if (reason.length === 0) {
        throw new Error("Rejecting a claim requires a non-empty reason.");
      }

      await repository.transitionClaimStatus({
        claimId: command.claimId,
        nextStatus: "rejected",
        confidenceScore: 0,
        conflictSeverity: "high",
        reason,
        transitionSource: "user",
        reviewedAt: new Date()
      });

      const removedEmbeddings = await embeddingCleanup?.removeClaimEmbeddings(command.claimId) ?? 0;

      return { claimId: command.claimId, status: "rejected", removedEmbeddings };
    }
  };
}
