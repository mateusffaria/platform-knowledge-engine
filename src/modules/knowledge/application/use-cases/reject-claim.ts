import { TrustedClaimRepository } from "../ports/trusted-claim-repository.js";

export function createRejectClaimUseCase(repository: TrustedClaimRepository) {
  return {
    async execute(command: { claimId: string; reason: string }): Promise<{ claimId: string; status: "rejected" }> {
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

      return { claimId: command.claimId, status: "rejected" };
    }
  };
}
