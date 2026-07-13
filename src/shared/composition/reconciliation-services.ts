import { loadConfig } from "../config/env.js";
import { createDatabase } from "../database/client.js";
import {
  createConfirmClaimUseCase,
  createListClaimsRequiringReviewUseCase,
  createRejectClaimUseCase
} from "../../modules/reconciliation/application/use-cases/index.js";
import { DrizzleTrustedClaimRepository } from "../../modules/knowledge/infrastructure/repositories/drizzle-trusted-claim-repository.js";
import { PgvectorStore } from "../../modules/retrieval/infrastructure/vector-stores/pgvector-store.js";

export function createProductionClaimReviewServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const repository = new DrizzleTrustedClaimRepository(database.db);
  const vectorStore = new PgvectorStore(database.db);

  return {
    listClaimsRequiringReview: createListClaimsRequiringReviewUseCase(repository),
    confirmClaim: createConfirmClaimUseCase(repository),
    rejectClaim: createRejectClaimUseCase(repository, {
      removeClaimEmbeddings(claimId: string) {
        return vectorStore.deleteEmbeddingsForSubject({
          subjectType: "evidence_claim",
          subjectId: claimId
        });
      }
    }),
    close: database.close
  };
}
