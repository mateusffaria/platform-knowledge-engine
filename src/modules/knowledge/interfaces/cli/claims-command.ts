import { Command } from "commander";

import { ClaimReviewItem } from "../../application/ports/trusted-claim-repository.js";
import { createProductionClaimReviewServices } from "../../infrastructure/claim-review-runner.js";

type ClaimReviewServicesFactory = typeof createProductionClaimReviewServices;

function printReviewItems(items: ClaimReviewItem[]): void {
  if (items.length === 0) {
    console.log("No claims currently require review.");
    return;
  }

  for (const [index, item] of items.entries()) {
    console.log(`${index + 1}. ${item.id} ${item.claimType} status=${item.status} severity=${item.conflictSeverity} confidence=${item.confidenceScore}`);
    console.log(`   ${item.claimText}`);
    console.log(`   source=${item.sourcePath} ${item.sourceReferenceSection} ${item.sourceReferenceLocator}`);
    if (item.reviewReason) {
      console.log(`   reason=${item.reviewReason}`);
    }
  }
}

export function registerClaimsCommands(
  program: Command,
  createServices: ClaimReviewServicesFactory = createProductionClaimReviewServices
): void {
  const claims = program
    .command("claims")
    .description("Review trusted professional knowledge claims");

  claims
    .command("review")
    .description("List claims requiring human review")
    .action(async () => {
      const services = createServices();
      try {
        printReviewItems(await services.listClaimsRequiringReview.execute());
      } finally {
        await services.close();
      }
    });

  claims
    .command("confirm")
    .description("Confirm a claim as trusted evidence")
    .argument("<claim-id>", "evidence claim id")
    .action(async (claimId: string) => {
      const services = createServices();
      try {
        await services.confirmClaim.execute({ claimId });
        console.log(`Confirmed claim ${claimId}.`);
      } finally {
        await services.close();
      }
    });

  claims
    .command("reject")
    .description("Reject a claim and remove trusted retrieval vectors")
    .argument("<claim-id>", "evidence claim id")
    .requiredOption("--reason <reason>", "reason for rejecting the claim")
    .action(async (claimId: string, options: { reason: string }) => {
      const services = createServices();
      try {
        await services.rejectClaim.execute({ claimId, reason: options.reason });
        const deleted = await services.deleteClaimEmbeddings.execute(claimId);
        console.log(`Rejected claim ${claimId}. Removed ${deleted} embedding(s).`);
      } finally {
        await services.close();
      }
    });
}
