## 1. Configuration and Factory

- [x] 1.1 Extend `AppConfig` and `loadConfig()` with embedding provider, embedding model, and Ollama base URL settings.
- [x] 1.2 Add `MissingEmbeddingProviderError` with an actionable Ollama setup message.
- [x] 1.3 Add `EmbeddingProviderFactory` that selects `OllamaEmbeddingProvider` for `EMBEDDING_PROVIDER=ollama`, rejects unsupported providers, and fails clearly when required settings are missing.
- [x] 1.4 Replace `ConfiguredEmbeddingProvider` wiring in `createProductionRetrievalServices()` with the provider factory.

## 2. Ollama Provider

- [x] 2.1 Add `OllamaEmbeddingProvider` under retrieval infrastructure using Node `fetch` and the configured Ollama base URL/model.
- [x] 2.2 Implement document embedding generation that returns one `EmbeddingVector` per input text with provider `ollama`, configured model, dimensions, and numeric values.
- [x] 2.3 Implement query embedding generation that returns one `EmbeddingVector` for a search query.
- [x] 2.4 Validate Ollama responses for HTTP failure, malformed JSON, missing embeddings, non-numeric values, empty vectors, count mismatch, and unsupported dimensions.

## 3. CLI and Documentation

- [x] 3.1 Update `pke index` and `pke search` error handling so missing provider configuration reports the actionable setup message and exits with failure.
- [x] 3.2 Update README or retrieval documentation with Ollama install, model pull, and environment variable setup.
- [x] 3.3 Review `.env.example` for the expected Ollama embedding configuration values.
- [x] 3.4 Align the existing embedding provider ADR/docs with the final factory and adapter names if implementation naming differs.

## 4. Tests and Verification

- [x] 4.1 Add provider factory tests for missing provider, unsupported provider, missing model, and successful Ollama selection.
- [x] 4.2 Add Ollama provider tests with mocked HTTP responses for successful document/query embeddings and HTTP/provider response failures.
- [x] 4.3 Add or update CLI tests for actionable missing-provider errors on `index` and `search`.
- [x] 4.4 Run `npm run typecheck` and `npm test`.
