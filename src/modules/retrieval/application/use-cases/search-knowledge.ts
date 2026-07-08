import { EmbeddingProvider } from "../ports/embedding-provider.js";
import { VectorStore } from "../ports/vector-store.js";
import { SearchQuery, SearchResult } from "../types.js";

export interface SearchKnowledgeDependencies {
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;
}

export function createSearchKnowledgeUseCase({
  embeddingProvider,
  vectorStore
}: SearchKnowledgeDependencies) {
  return {
    async execute(input: SearchQuery): Promise<SearchResult[]> {
      const query = input.query.trim();
      if (query.length === 0) {
        throw new Error("Search query must not be empty.");
      }

      const embedding = await embeddingProvider.embedQuery(query);

      return vectorStore.search({
        embedding,
        limit: input.limit ?? 10
      });
    }
  };
}
