## Why

Semantic indexing and vector search already depend on an `EmbeddingProvider` port, but the configured runtime provider currently fails intentionally because no concrete production adapter exists. Adding a local Ollama-backed provider completes the local-first retrieval path and makes `pke index` and `pke search` usable with verified knowledge embeddings.

## What Changes

- Add a concrete Ollama embedding provider infrastructure adapter.
- Add provider selection at the composition root through an embedding provider factory.
- Configure the provider with `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, and `OLLAMA_BASE_URL`.
- Replace the generic configured provider failure with a specific missing-provider error and actionable CLI messages.
- Validate embedding dimensions before persistence and search.
- Document local Ollama setup for semantic indexing and search.
- Add focused tests for provider factory behavior, Ollama HTTP handling, and clear missing-provider failures.

## Capabilities

### New Capabilities

- `ollama-embedding-provider`: Runtime embedding provider selection and Ollama embedding generation for indexing and semantic search.

### Modified Capabilities

- None.

## Impact

- Affected runtime code: retrieval composition root, embedding provider infrastructure, CLI error handling for `pke index` and `pke search`.
- Affected configuration: `.env.example` and documentation for `EMBEDDING_PROVIDER=ollama`, `EMBEDDING_MODEL=nomic-embed-text`, and `OLLAMA_BASE_URL=http://localhost:11434`.
- Affected tests: provider factory unit tests, Ollama provider tests with mocked HTTP responses, and existing semantic retrieval tests where composition changes require updates.
- Architecture impact: application use cases continue to depend only on the `EmbeddingProvider` port; Ollama and HTTP details remain in infrastructure.
