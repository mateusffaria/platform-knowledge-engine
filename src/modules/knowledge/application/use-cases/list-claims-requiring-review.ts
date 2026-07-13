import { TrustedClaimRepository } from "../ports/trusted-claim-repository.js";

export function createListClaimsRequiringReviewUseCase(repository: TrustedClaimRepository) {
  return {
    async execute() {
      return repository.listClaimsRequiringReview();
    }
  };
}
