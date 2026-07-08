import { loadConfig } from "../../../shared/config/env.js";
import { createDatabase } from "../../../shared/database/client.js";
import { DrizzleIndexableKnowledgeReader } from "../../knowledge/infrastructure/repositories/drizzle-indexable-knowledge-reader.js";
import { createIndexKnowledgeUseCase } from "../application/use-cases/index-knowledge.js";
import { createSearchKnowledgeUseCase } from "../application/use-cases/search-knowledge.js";
import { ConfiguredEmbeddingProvider } from "./embedding-providers/configured-embedding-provider.js";
import { PgvectorStore } from "./vector-stores/pgvector-store.js";

export function createProductionRetrievalServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const knowledgeReader = new DrizzleIndexableKnowledgeReader(database.db);
  const embeddingProvider = new ConfiguredEmbeddingProvider();
  const vectorStore = new PgvectorStore(database.db);

  return {
    indexKnowledge: createIndexKnowledgeUseCase({
      knowledgeReader,
      embeddingProvider,
      vectorStore
    }),
    searchKnowledge: createSearchKnowledgeUseCase({
      embeddingProvider,
      vectorStore
    }),
    close: database.close
  };
}
