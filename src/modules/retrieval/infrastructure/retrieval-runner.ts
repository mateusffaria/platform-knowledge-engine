import { loadConfig } from "../../../shared/config/env.js";
import { createDatabase } from "../../../shared/database/client.js";
import { DrizzleIndexableKnowledgeReader } from "../../knowledge/infrastructure/repositories/drizzle-indexable-knowledge-reader.js";
import { DrizzleKnowledgeMetadataProvider } from "../../knowledge/infrastructure/repositories/drizzle-knowledge-metadata-provider.js";
import { DrizzleStructuredKnowledgeSearch } from "../../knowledge/infrastructure/repositories/drizzle-structured-knowledge-search.js";
import { isClaimIndexableStatus } from "../../reconciliation/domain/eligibility.js";
import { createHybridSearchUseCase } from "../application/use-cases/hybrid-search.js";
import { createIndexKnowledgeUseCase } from "../application/use-cases/index-knowledge.js";
import { createSearchKnowledgeUseCase } from "../application/use-cases/search-knowledge.js";
import { EmbeddingProviderFactory } from "./embedding-providers/embedding-provider-factory.js";
import { IndexableCanonicalEvidenceReader } from "./canonical-readers/indexable-canonical-evidence-reader.js";
import { PgvectorStore } from "./vector-stores/pgvector-store.js";

export function createProductionRetrievalServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const knowledgeReader = new DrizzleIndexableKnowledgeReader(database.db);
  const knowledgeMetadataProvider = new DrizzleKnowledgeMetadataProvider(database.db);
  const structuredKnowledgeSearch = new DrizzleStructuredKnowledgeSearch(database.db);
  const embeddingProvider = new EmbeddingProviderFactory().create(config);
  const vectorStore = new PgvectorStore(database.db);

  return {
    indexKnowledge: createIndexKnowledgeUseCase({
      knowledgeReader,
      embeddingProvider,
      vectorStore,
      claimEligibilityPolicy: {
        canIndexClaim(claim) {
          return isClaimIndexableStatus(claim.status);
        }
      }
    }),
    searchKnowledge: createSearchKnowledgeUseCase({
      embeddingProvider,
      vectorStore,
      defaultMinScore: config.semanticSearchMinScore
    }),
    hybridSearch: createHybridSearchUseCase({
      embeddingProvider,
      vectorStore,
      structuredKnowledgeSearch,
      knowledgeMetadataProvider
    }),
    canonicalEvidenceReader: new IndexableCanonicalEvidenceReader(knowledgeReader),
    close: database.close
  };
}
