import { AppConfig } from "../../../../shared/config/env.js";
import { embeddingDimensions } from "../../../../shared/database/schema.js";
import { EmbeddingProvider } from "../../application/ports/embedding-provider.js";
import { MissingEmbeddingProviderError, ollamaEmbeddingSetupMessage } from "./missing-embedding-provider-error.js";
import { OllamaEmbeddingProvider } from "./ollama-embedding-provider.js";

export class EmbeddingProviderFactory {
  create(config: AppConfig): EmbeddingProvider {
    const provider = config.embeddingProvider?.trim().toLowerCase();
    if (!provider) {
      throw new MissingEmbeddingProviderError();
    }

    if (provider !== "ollama") {
      throw new Error(`Unsupported embedding provider "${config.embeddingProvider}". Supported providers: ollama.`);
    }

    if (!config.embeddingModel?.trim()) {
      throw new MissingEmbeddingProviderError(`EMBEDDING_MODEL is required for Ollama embeddings. ${ollamaEmbeddingSetupMessage}`);
    }

    return new OllamaEmbeddingProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.embeddingModel,
      expectedDimensions: embeddingDimensions
    });
  }
}
