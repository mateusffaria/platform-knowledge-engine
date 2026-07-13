import { loadConfig } from "../../../shared/config/env.js";
import { createDatabase } from "../../../shared/database/client.js";
import { createConfirmClaimUseCase } from "../application/use-cases/confirm-claim.js";
import { createListClaimsRequiringReviewUseCase } from "../application/use-cases/list-claims-requiring-review.js";
import { createRejectClaimUseCase } from "../application/use-cases/reject-claim.js";
import { DrizzleTrustedClaimRepository } from "./repositories/drizzle-trusted-claim-repository.js";
import { PgvectorStore } from "../../retrieval/infrastructure/vector-stores/pgvector-store.js";

export function createProductionClaimReviewServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const repository = new DrizzleTrustedClaimRepository(database.db);
  const vectorStore = new PgvectorStore(database.db);

  return {
    listClaimsRequiringReview: createListClaimsRequiringReviewUseCase(repository),
    confirmClaim: createConfirmClaimUseCase(repository),
    rejectClaim: createRejectClaimUseCase(repository),
    deleteClaimEmbeddings: {
      execute(claimId: string) {
        return vectorStore.deleteEmbeddingsForSubject({
          subjectType: "evidence_claim",
          subjectId: claimId
        });
      }
    },
    close: database.close
  };
}
