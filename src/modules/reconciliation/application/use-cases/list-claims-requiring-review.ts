import { ClaimReconciliationRepository } from "../ports/claim-reconciliation-repository.js";

export function createListClaimsRequiringReviewUseCase(repository: ClaimReconciliationRepository) {
  return {
    async execute() {
      return repository.listClaimsRequiringReview();
    }
  };
}
