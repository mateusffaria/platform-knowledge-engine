# AEM-003 — Semantic Knowledge

## Goal

Introduce semantic indexing using pgvector.

## Problem

Structured queries are useful for exact facts, but professional experience often needs semantic retrieval.

Example:

> Find evidence of technical leadership in distributed systems.

This type of query may not map directly to a single keyword.

## Scope

- deterministic embedding text builder
- EmbeddingProvider port
- VectorStore port
- pgvector adapter
- embedding persistence
- `pke index`
- `pke search "<query>"`
- tests with mocked embeddings

## Out of Scope

- resume generation
- cover letter generation
- multiple LLM providers
- full hybrid retrieval ranking
- benchmarking

## Architectural Decisions

### Deterministic embedding text

Embeddings should be created from deterministic text generated from structured knowledge.

The system should not use free-form LLM summaries as the source for embeddings.

### Verified knowledge only

Only eligible and validated knowledge should be indexed as searchable evidence.

## Acceptance Criteria

- Knowledge can be indexed.
- Semantic search returns related evidence.
- Existing ingestion behavior remains unchanged.
- Embedding generation is testable with mocked providers.

## Risks

- Poor embedding text may reduce retrieval quality.
- Over-indexing unverified claims may contaminate search results.
- pgvector schema may need to evolve later.

## Next Milestone

AEM-004 — Trusted Knowledge.
