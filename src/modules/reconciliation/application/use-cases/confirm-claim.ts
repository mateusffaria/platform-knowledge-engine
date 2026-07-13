import { ClaimReconciliationRepository } from "../ports/claim-reconciliation-repository.js";

export function createConfirmClaimUseCase(repository: ClaimReconciliationRepository) {
  return {
    async execute(command: { claimId: string; reason?: string }): Promise<{ claimId: string; status: "confirmed" }> {
      await repository.transitionClaimStatus({
        claimId: command.claimId,
        nextStatus: "confirmed",
        confidenceScore: 100,
        conflictSeverity: "none",
        reason: command.reason ?? "Confirmed by user review.",
        transitionSource: "user",
        reviewedAt: new Date()
      });

      return { claimId: command.claimId, status: "confirmed" };
    }
  };
}
