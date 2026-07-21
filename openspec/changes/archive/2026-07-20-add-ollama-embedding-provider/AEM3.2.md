rodar openspec apply em add-ollama-embedding-provider




Add Ollama embedding provider implementation.

Context:
Semantic indexing and vector search have been implemented through provider ports, but the configured embedding provider currently throws intentionally because no production provider exists.

Goal:
Implement the first concrete EmbeddingProvider using Ollama, aligned with the local-first architecture.

Scope:
- Add docs/adr/0001-embedding-provider-strategy.md
- Rename ConfiguredEmbeddingProvider if needed to avoid misleading semantics
- Add EmbeddingProviderFactory
- Add OllamaEmbeddingProvider infrastructure adapter
- Configure provider selection using environment variables:
  - EMBEDDING_PROVIDER=ollama
  - EMBEDDING_MODEL=nomic-embed-text
  - OLLAMA_BASE_URL=http://localhost:11434
- Add a specific MissingEmbeddingProviderError
- Update CLI error handling for pke index and pke search
- Update README or docs with Ollama setup instructions
- Add tests for provider factory behavior
- Add tests for OllamaEmbeddingProvider using mocked HTTP responses
- Keep application use cases dependent only on the EmbeddingProvider port

Rules:
- Application layer must not import Ollama SDK or HTTP clients directly
- Ollama implementation must live in infrastructure
- Provider selection must happen at composition root/factory level
- Missing provider configuration must fail with a clear actionable error
- Embedding dimensions must be validated before persisting/searching
- Do not introduce OpenAI provider yet

Out of scope:
- OpenAI embeddings
- provider benchmarking
- retry policies beyond basic HTTP error handling
- caching embeddings
- hybrid retrieval ranking
- document generation

Acceptance criteria:
- pke index works when Ollama is running and nomic-embed-text is available
- pke search "<query>" works with Ollama embeddings
- missing provider configuration returns a clear CLI error
- tests pass
- architecture boundaries are preserved
