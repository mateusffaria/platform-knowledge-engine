## Why

The project can persist verified professional knowledge, but it does not yet have a retrieval foundation for finding relevant evidence by meaning. Adding semantic indexing and vector search now creates the base needed for later document generation and agent workflows while preserving the existing ingestion source of truth.

## What Changes

- Add a `knowledge_embeddings` persistence model backed by PostgreSQL `pgvector`.
- Introduce retrieval application ports for embedding generation and vector storage.
- Add deterministic embedding text generation for `KnowledgeAsset` and `EvidenceClaim` records.
- Add a pgvector-backed infrastructure adapter for storing and searching embeddings.
- Add `pke index` to embed verified persisted knowledge idempotently.
- Add `pke search "<query>"` to return related evidence from vector search.
- Add tests for deterministic embedding text generation and vector search flow with mocked embeddings.
- Preserve existing ingestion behavior and ensure vector search references source knowledge rather than becoming the source of truth.

## Capabilities

### New Capabilities

- `semantic-retrieval`: Covers deterministic semantic indexing of verified professional knowledge, pgvector storage, and CLI vector search over indexed evidence.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/modules/retrieval`, `src/modules/knowledge`, `src/shared/database`, `src/cli`, and focused tests under `tests/`.
- Affected APIs: new CLI commands `pke index` and `pke search "<query>"`; new application ports for embeddings and vector storage.
- Dependencies and systems: PostgreSQL must enable/use `pgvector`; Drizzle schema and migrations gain a `knowledge_embeddings` table.
- Behavioral constraints: ingestion remains unchanged, indexing is idempotent, embeddings point back to `KnowledgeAsset` or `EvidenceClaim`, and rejected or unverified claims are not indexed as confirmed facts.
