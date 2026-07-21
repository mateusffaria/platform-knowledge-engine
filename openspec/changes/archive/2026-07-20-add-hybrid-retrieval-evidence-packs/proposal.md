## Why

The project can ingest, validate, reconcile, index, and semantically search professional knowledge, but it does not yet provide a single retrieval workflow that combines exact structured matches with semantic matches. This change introduces a traceable Evidence Pack so downstream document generation and users can consume ranked evidence without losing source provenance or trust status.

## What Changes

- Add deterministic query planning that selects structured retrieval, semantic retrieval, or both from the query shape.
- Add structured knowledge search as an application port consumed by the retrieval module.
- Add a hybrid retrieval use case that orchestrates structured search and the existing semantic vector search.
- Add Evidence Pack and Evidence Item domain models with ranking, deduplication, provenance, trust metadata, source excerpts, warnings, and retrieval timestamps.
- Add deterministic ranking rules with configurable weights for trust status, exact structured matches, and semantic similarity.
- Add a `pke retrieve "<query>"` CLI command with filtering and output options.
- Preserve existing `pke search` behavior while making hybrid retrieval a separate application-level capability.
- Update retrieval, architecture, and roadmap documentation for the new retrieval flow and scoring semantics.

## Capabilities

### New Capabilities

- `hybrid-retrieval`: Combines structured and semantic retrieval into ranked, deduplicated, traceable Evidence Packs.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/modules/retrieval`, retrieval CLI wiring, knowledge/reconciliation application contracts used by retrieval, and focused tests under `tests/`.
- Affected APIs: new retrieval use case, structured search port, Evidence Pack model, ranking configuration, and `pke retrieve` CLI command.
- Dependencies: reuses the existing vector store and embedding provider contracts; does not require an LLM planner or new external service.
- Systems: PostgreSQL and pgvector remain infrastructure adapters; retrieval must respect modular monolith boundaries and must not import knowledge or reconciliation infrastructure directly.
