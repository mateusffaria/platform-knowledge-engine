export const ollamaEmbeddingSetupMessage = [
  "Semantic retrieval requires an embedding provider.",
  "Set EMBEDDING_PROVIDER=ollama, EMBEDDING_MODEL=nomic-embed-text, and OLLAMA_BASE_URL=http://localhost:11434.",
  "Then make sure Ollama is running and the model has been pulled with: ollama pull nomic-embed-text."
].join(" ");

export class MissingEmbeddingProviderError extends Error {
  constructor(message = ollamaEmbeddingSetupMessage) {
    super(message);
    this.name = "MissingEmbeddingProviderError";
  }
}
