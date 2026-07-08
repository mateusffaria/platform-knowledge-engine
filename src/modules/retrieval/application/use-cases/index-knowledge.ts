import { IndexableKnowledgeReader } from "../../../knowledge/application/ports/indexable-knowledge-reader.js";
import { buildEvidenceClaimEmbeddingDocument, buildKnowledgeAssetEmbeddingDocument } from "../embedding-text.js";
import { EmbeddingProvider } from "../ports/embedding-provider.js";
import { VectorStore } from "../ports/vector-store.js";
import { EmbeddingDocument, IndexSummary } from "../types.js";

export interface IndexKnowledgeDependencies {
  knowledgeReader: IndexableKnowledgeReader;
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;
}

export function createIndexKnowledgeUseCase({
  knowledgeReader,
  embeddingProvider,
  vectorStore
}: IndexKnowledgeDependencies) {
  return {
    async execute(): Promise<IndexSummary> {
      const [assets, claims] = await Promise.all([
        knowledgeReader.listIndexableKnowledgeAssets(),
        knowledgeReader.listIndexableEvidenceClaims()
      ]);
      const eligibleClaims = claims.filter((claim) => claim.verified);
      const documents: EmbeddingDocument[] = [
        ...assets.map(buildKnowledgeAssetEmbeddingDocument),
        ...eligibleClaims.map(buildEvidenceClaimEmbeddingDocument)
      ];

      if (documents.length === 0) {
        return { indexed: 0, skipped: 0 };
      }

      const embeddings = await embeddingProvider.embedDocuments(documents.map((document) => document.text));
      if (embeddings.length !== documents.length) {
        throw new Error("Embedding provider returned a different number of document embeddings than requested.");
      }

      const result = await vectorStore.upsertEmbeddings(
        documents.map((document, index) => ({
          document,
          embedding: embeddings[index]
        }))
      );

      return {
        indexed: result.inserted + result.updated,
        skipped: result.unchanged
      };
    }
  };
}
