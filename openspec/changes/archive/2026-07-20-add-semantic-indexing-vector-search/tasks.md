## 1. Database and Knowledge Access

- [x] 1.1 Add `knowledge_embeddings` schema support with pgvector extension setup, subject identifiers, source identifiers, embedding metadata, vector value, timestamps, and uniqueness/indexes for idempotent indexing.
- [x] 1.2 Generate and review the Drizzle migration for `knowledge_embeddings` and pgvector support.
- [x] 1.3 Add a knowledge read contract that returns indexable `KnowledgeAsset` and `EvidenceClaim` records with source provenance and verification eligibility.
- [x] 1.4 Implement the production knowledge reader without importing knowledge infrastructure directly from retrieval use cases.

## 2. Retrieval Application Core

- [x] 2.1 Define retrieval application types for indexable records, embedding documents, index summaries, search queries, and search results.
- [x] 2.2 Add the `EmbeddingProvider` port for document and query embedding generation.
- [x] 2.3 Add the `VectorStore` port for idempotent vector upserts and similarity search.
- [x] 2.4 Implement deterministic embedding text builders for `KnowledgeAsset` and `EvidenceClaim` records.
- [x] 2.5 Implement the indexing use case to read eligible knowledge, build deterministic embedding documents, generate embeddings, and upsert vectors idempotently.
- [x] 2.6 Implement the search use case to embed a query, search vectors, and return results with original subject/source identifiers.

## 3. Infrastructure and CLI Wiring

- [x] 3.1 Implement the pgvector-backed `VectorStore` adapter against the shared database client/schema.
- [x] 3.2 Add an initial production `EmbeddingProvider` adapter or explicit local placeholder that fails with actionable configuration guidance.
- [x] 3.3 Add retrieval CLI interface code for `pke index` and `pke search "<query>"`.
- [x] 3.4 Register retrieval commands from `src/cli/index.ts` while keeping the top-level CLI as a thin composition root.
- [x] 3.5 Ensure `pke ingest` behavior does not require indexing or embedding configuration.

## 4. Verification

- [x] 4.1 Add tests proving embedding text generation is deterministic and preserves asset/claim provenance.
- [x] 4.2 Add tests proving the indexing use case does not duplicate unchanged embeddings when run twice with mocked embeddings.
- [x] 4.3 Add tests proving search uses mocked `EmbeddingProvider` and `VectorStore` ports and returns related evidence identifiers.
- [x] 4.4 Add tests or assertions proving rejected or unverified claims are excluded from confirmed indexing when eligibility data is present.
- [x] 4.5 Run `npm run typecheck` and `npm test`, confirming existing ingestion tests continue passing.
