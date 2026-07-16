import { EmbeddingDocument, EmbeddingVector, SearchResult } from "../types.js";

export interface VectorUpsertInput {
  document: EmbeddingDocument;
  embedding: EmbeddingVector;
}

export interface VectorSearchInput {
  embedding: EmbeddingVector;
  limit: number;
  candidateEvidenceClaimIds?: string[];
  candidateKnowledgeAssetIds?: string[];
}

export interface VectorStore {
  upsertEmbeddings(inputs: VectorUpsertInput[], options?: { force?: boolean }): Promise<{ inserted: number; updated: number; unchanged: number }>;
  search(input: VectorSearchInput): Promise<SearchResult[]>;
  deleteEmbeddingsForSubject(input: { subjectType: "knowledge_asset" | "evidence_claim"; subjectId: string }): Promise<number>;
}
