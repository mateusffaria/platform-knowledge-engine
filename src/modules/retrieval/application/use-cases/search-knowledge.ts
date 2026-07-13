import { EmbeddingProvider } from "../ports/embedding-provider.js";
import { VectorStore } from "../ports/vector-store.js";
import { SearchKnowledgeResult, SearchQuery } from "../types.js";

export interface SearchKnowledgeDependencies {
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;
  defaultMinScore?: number;
}

export function createSearchKnowledgeUseCase({
  embeddingProvider,
  vectorStore,
  defaultMinScore
}: SearchKnowledgeDependencies) {
  return {
    async execute(input: SearchQuery): Promise<SearchKnowledgeResult> {
      const query = input.query.trim();
      if (query.length === 0) {
        throw new Error("Search query must not be empty.");
      }

      const limit = input.limit ?? 10;
      const minScore = input.minScore ?? defaultMinScore;
      const embedding = await embeddingProvider.embedQuery(query);
      const rankedResults = await vectorStore.search({
        embedding,
        limit
      });

      if (minScore === undefined) {
        return {
          status: "results",
          query,
          limit,
          results: rankedResults
        };
      }

      const results = rankedResults.filter((result) => result.similarityScore >= minScore);
      if (results.length === 0) {
        return {
          status: "no_relevant_evidence",
          query,
          limit,
          minScore,
          bestSimilarityScore: rankedResults[0]?.similarityScore,
          results: []
        };
      }

      return {
        status: "results",
        query,
        limit,
        minScore,
        results
      };
    }
  };
}
