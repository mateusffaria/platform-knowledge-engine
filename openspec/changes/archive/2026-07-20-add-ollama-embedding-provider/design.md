## Context

Semantic retrieval is already modeled behind application ports: indexing and search use `EmbeddingProvider` and `VectorStore`, and `PgvectorStore` validates vectors against the persisted `768`-dimension schema used by `nomic-embed-text`. The runtime composition currently wires `ConfiguredEmbeddingProvider`, which throws because no real provider exists. ADR 0002 already selects Ollama as the first concrete provider and keeps future providers behind the same factory boundary.

The change must preserve the local-first architecture. Application use cases must stay provider-agnostic, while environment parsing, provider selection, HTTP calls, and CLI presentation remain outside the application layer.

## Goals / Non-Goals

**Goals:**

- Provide an Ollama-backed `EmbeddingProvider` that can embed documents for `pke index` and a single query for `pke search`.
- Select embedding providers at the retrieval composition root using environment-backed configuration.
- Fail clearly when embedding configuration is missing, unsupported, or incomplete.
- Validate provider output shape and dimensions before vectors are persisted or searched.
- Keep Ollama and HTTP details in retrieval infrastructure.
- Document the local Ollama setup needed for `nomic-embed-text`.

**Non-Goals:**

- Add OpenAI or any other non-Ollama provider.
- Add embedding caching, benchmarking, advanced retries, or hybrid ranking.
- Change the embedding text contract, vector schema, or pgvector persistence model.
- Generate or trust new career facts from embeddings or LLM output.

## Decisions

1. Add `EmbeddingProviderFactory` in retrieval infrastructure.

   The factory will consume the loaded app configuration and return an `EmbeddingProvider`. If `EMBEDDING_PROVIDER` is unset or empty, it will throw `MissingEmbeddingProviderError` with instructions to set `EMBEDDING_PROVIDER=ollama`, `EMBEDDING_MODEL=nomic-embed-text`, and `OLLAMA_BASE_URL=http://localhost:11434`.

   Alternatives considered:

   - Keep `ConfiguredEmbeddingProvider` as a throwing placeholder. This keeps the code simple but prevents semantic retrieval from working.
   - Instantiate `OllamaEmbeddingProvider` directly in `retrieval-runner.ts`. This works for the first provider but makes future provider selection harder and conflicts with the ADR.

2. Extend shared configuration with optional embedding settings.

   `loadConfig()` will expose `embeddingProvider`, `embeddingModel`, and `ollamaBaseUrl`. Defaults should be conservative: the provider should remain missing unless explicitly configured, while `OLLAMA_BASE_URL` can default to `http://localhost:11434` once Ollama is selected. The model should be required for configured providers so stored embedding identity is explicit.

   Alternatives considered:

   - Read `process.env` directly in the factory. That scatters configuration access and makes tests less direct.
   - Default `EMBEDDING_PROVIDER=ollama`. That is convenient but can surprise users who have not installed Ollama or pulled a model.

3. Implement Ollama through plain HTTP in infrastructure.

   `OllamaEmbeddingProvider` will call Ollama's local embeddings endpoint with the configured model and input text. It will map each result into the existing `EmbeddingVector` shape with `provider: "ollama"`, the configured model, detected dimensions, and numeric values.

   Alternatives considered:

   - Add an Ollama SDK dependency. The current needs are small, Node 22 has `fetch`, and avoiding a dependency keeps the adapter easier to test.
   - Batch all documents through a provider-specific SDK abstraction. That adds indirection before there is a second provider.

4. Validate provider responses at the adapter boundary.

   The Ollama adapter will reject missing embeddings, non-array embeddings, non-numeric values, empty vectors, and vectors whose dimensions do not match the configured database dimension. The vector store already validates before persistence/search, but adapter validation produces clearer provider-specific failures earlier.

   Alternatives considered:

   - Rely only on `PgvectorStore` validation. This protects storage but yields lower-level errors and lets invalid provider responses travel farther through the system.

5. Handle missing-provider errors explicitly in CLI commands.

   `pke index` and `pke search` will catch `MissingEmbeddingProviderError`, print an actionable message, set a failing exit code, and still close database resources when services were created. Other errors should continue to fail normally.

   Alternatives considered:

   - Let all errors bubble through Commander. That is acceptable for unexpected failures but produces less helpful guidance for the most likely setup problem.

## Risks / Trade-offs

- Ollama API shape can differ by version -> Keep the adapter narrowly tested with representative mocked responses and surface malformed responses clearly.
- `nomic-embed-text` dimensions must match the database vector dimension -> Validate dimensions in the adapter and retain the existing `PgvectorStore` guard.
- A missing provider may be detected after database setup if service creation stays monolithic -> Keep factory errors clear, and prefer constructing the provider before work that depends on it.
- Per-text HTTP calls may be slower for large indexes -> Accept for the first local-first provider; batching and retry policy remain future work.

## Migration Plan

No database migration is required. The existing `knowledge_embeddings` schema already stores provider, model, dimensions, and vectors.

Implementation steps:

- Add embedding configuration fields and documentation.
- Replace the placeholder provider wiring with the factory-created provider.
- Add the Ollama adapter and provider-specific errors.
- Update CLI command error handling.
- Add focused tests and run `npm run typecheck` and `npm test`.

Rollback strategy: restore the retrieval runner to the placeholder provider and remove the factory wiring. Existing embedding rows can remain because the schema is unchanged.

## Open Questions

- None.
