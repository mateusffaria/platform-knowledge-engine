import { EmbeddingVector } from "../types.js";

export interface EmbeddingProvider {
  embedDocuments(texts: string[]): Promise<EmbeddingVector[]>;
  embedQuery(text: string): Promise<EmbeddingVector>;
}
