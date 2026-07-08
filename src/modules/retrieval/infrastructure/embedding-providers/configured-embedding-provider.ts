import { EmbeddingProvider } from "../../application/ports/embedding-provider.js";
import { EmbeddingVector } from "../../application/types.js";

export class ConfiguredEmbeddingProvider implements EmbeddingProvider {
  async embedDocuments(_texts: string[]): Promise<EmbeddingVector[]> {
    throw new Error(
      "Semantic retrieval needs an embedding provider before indexing. Configure a production EmbeddingProvider adapter, then rerun pke index."
    );
  }

  async embedQuery(_text: string): Promise<EmbeddingVector> {
    throw new Error(
      "Semantic retrieval needs an embedding provider before search. Configure a production EmbeddingProvider adapter, then rerun pke search."
    );
  }
}
