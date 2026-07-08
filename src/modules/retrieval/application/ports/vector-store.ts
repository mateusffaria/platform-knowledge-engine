import { EmbeddingDocument, EmbeddingVector, SearchResult } from "../types.js";

export interface VectorUpsertInput {
  document: EmbeddingDocument;
  embedding: EmbeddingVector;
}

export interface VectorSearchInput {
  embedding: EmbeddingVector;
  limit: number;
}

export interface VectorStore {
  upsertEmbeddings(inputs: VectorUpsertInput[]): Promise<{ inserted: number; updated: number; unchanged: number }>;
  search(input: VectorSearchInput): Promise<SearchResult[]>;
}
