## Context

The project already persists canonical career knowledge in PostgreSQL through Drizzle and exposes ingestion through a modular CLI. The retrieval module currently exists as a placeholder, and the architecture refactor establishes that retrieval must use application contracts rather than importing knowledge infrastructure directly.

This change adds the first semantic retrieval foundation: deterministic embedding text derived from persisted professional knowledge, an embedding provider boundary, a vector store boundary, pgvector-backed storage, and CLI commands for indexing and searching. Vector search must remain a retrieval aid over verified source records, not a replacement source of truth.

## Goals / Non-Goals

**Goals:**

- Store embeddings for persisted `KnowledgeAsset` and `EvidenceClaim` records in PostgreSQL using `pgvector`.
- Generate deterministic text for embedding so repeated indexing produces stable hashes and idempotent writes.
- Keep embedding generation and vector persistence behind retrieval application ports.
- Add `pke index` for idempotent indexing and `pke search "<query>"` for semantic lookup.
- Return search results that reference original knowledge/evidence records and source context.
- Test embedding text generation and vector search flow with mocked embeddings.

**Non-Goals:**

- Resume generation, cover letter generation, UI/dashboard work, agent orchestration, benchmarking, or provider comparison.
- Full hybrid retrieval ranking or reranking.
- Changing ingestion behavior or making vector search authoritative over canonical knowledge.
- Introducing a dependency injection framework.

## Decisions

### Decision: Put orchestration in the retrieval module with explicit ports

The retrieval module will own indexing and search use cases. It will define an `EmbeddingProvider` port for embedding text/query input and a `VectorStore` port for upserting/searching vectors. The use cases will depend on a small read contract for indexable knowledge records so they can retrieve `KnowledgeAsset` and `EvidenceClaim` data without importing knowledge infrastructure.

Alternative considered: implement `pke index` directly in the CLI against database tables. That would be faster to wire but would violate the module boundary established by the architecture change and make later provider or store swaps harder.

### Decision: Use deterministic embedding documents as the idempotency boundary

Each indexable record will be converted into a deterministic embedding document with stable field ordering, explicit subject type/id, source identifiers, claim type where applicable, and normalized textual content. The indexer will hash this embedding text plus relevant provider/model metadata and use that hash with the subject identity to decide whether to insert, skip, or update a vector row.

Alternative considered: embed raw database rows as serialized JSON. That risks unstable key ordering, accidental metadata churn, and embeddings that change for reasons unrelated to retrievable content.

### Decision: Store vectors in a dedicated `knowledge_embeddings` table

The database schema will add a `knowledge_embeddings` table containing an embedding id, subject type (`knowledge_asset` or `evidence_claim`), subject id, source identifiers, deterministic text hash, provider/model/dimension metadata, vector value, and timestamps. The table will enforce uniqueness for the idempotency key and include indexes needed for subject lookup and vector search.

Alternative considered: add embedding columns directly to `knowledge_assets` and `evidence_claims`. A separate table keeps retrieval metadata isolated, supports multiple subject types consistently, and leaves canonical knowledge tables as the source of truth.

### Decision: Treat verification eligibility as part of indexable knowledge selection

The indexable knowledge read contract will return only records eligible for confirmed semantic retrieval. With the current model, persisted canonical career records are the eligible source; if future status fields are added, rejected or unverified claims must be filtered before embedding and must not be presented as confirmed facts.

Alternative considered: index everything and label lower-confidence records in search results. That would increase recall but conflicts with the requirement that rejected or unverified claims are not indexed as confirmed facts.

### Decision: Keep CLI commands thin and compositional

`src/cli/index.ts` will register `pke index` and `pke search "<query>"` through retrieval CLI interface code. Production composition will wire the knowledge reader, embedding provider, and pgvector adapter. Tests can exercise use cases with fake knowledge sources, embedding providers, and vector stores.

Alternative considered: share most command implementation between ingestion and retrieval in the top-level CLI. That centralizes code but blurs capability ownership.

## Risks / Trade-offs

- [Risk] Embedding dimensions can vary by provider/model, making table constraints and migrations brittle -> Mitigation: store model and dimension metadata, validate dimensions before upsert, and choose one configured production model per run.
- [Risk] `pgvector` extension availability can break migrations on a fresh database -> Mitigation: include extension setup in migration/schema workflow and document the database prerequisite.
- [Risk] Re-indexing may duplicate vectors if the idempotency key is incomplete -> Mitigation: enforce a unique key over subject identity plus embedding text/provider/model metadata and cover duplicate behavior in tests.
- [Risk] Vector search can be mistaken for source truth -> Mitigation: results return original subject ids and evidence/source context, and consumers continue reading canonical knowledge for facts.
- [Risk] The current schema does not model rejected/unverified status -> Mitigation: keep eligibility filtering centralized in the knowledge read contract so future verification states are filtered before indexing.

## Migration Plan

1. Add the `knowledge_embeddings` schema and migration, including pgvector extension support and uniqueness/indexes.
2. Add retrieval domain/application types for indexable knowledge, embedding documents, search queries, and search results.
3. Add `EmbeddingProvider` and `VectorStore` ports plus deterministic embedding text builder tests.
4. Add a knowledge read contract/adapter that provides eligible `KnowledgeAsset` and `EvidenceClaim` records for indexing.
5. Implement the pgvector `VectorStore` adapter and verify idempotent upsert behavior.
6. Add `pke index` and `pke search "<query>"` through retrieval CLI registration.
7. Run typecheck and tests, including existing ingestion tests, to verify ingestion behavior remains unchanged.

Rollback: remove the retrieval CLI registrations and drop or ignore `knowledge_embeddings`; canonical knowledge tables and ingestion behavior remain unchanged.

## Open Questions

- Which embedding provider/model should production use first, and how should its credentials be configured?
- Should `pke index` index both `KnowledgeAsset` summaries and every `EvidenceClaim` by default, or start with evidence claims only and add asset-level embeddings later?
