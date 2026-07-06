# OpenSpec Input Notes

## Architecture Refactor

Use this when updating the project to Modular Monolith + Hexagonal Architecture.

```text
Refactor the project architecture to a modular monolith with hexagonal boundaries.

Goal:
Restructure the codebase around business capabilities instead of technical layers while preserving existing behavior.

Architecture:
Use a modular monolith architecture with Hexagonal Architecture / Ports and Adapters inside each module.

Modules:
- ingestion
- knowledge
- retrieval
- jobs
- documents
- shared

Dependency rules:
- domain must not depend on infrastructure
- application may depend on domain and ports
- infrastructure implements ports
- CLI must call application use cases only
- cross-module access must happen through explicit application services or ports

Scope:
- move existing ingestion logic into the ingestion module
- move persisted career knowledge concepts into the knowledge module
- keep existing CLI behavior working
- update tests
- update docs
```

## Semantic Knowledge

Use this for the next milestone after the architecture refactor.

```text
Add semantic indexing and vector search using pgvector.

Goal:
Create the retrieval foundation by generating embeddings from verified professional knowledge and storing them in PostgreSQL using pgvector.

Scope:
- add pgvector extension setup/migration if missing
- create knowledge_embeddings table
- add EmbeddingProvider port
- add VectorStore port
- add deterministic text builder for KnowledgeAssets/EvidenceClaims
- add pgvector adapter
- add CLI command: pke index
- add CLI command: pke search "<query>"
- add tests using mocked embeddings

Out of scope:
- resume generation
- cover letter generation
- benchmarking
- full hybrid retrieval ranking
- UI/dashboard

Acceptance criteria:
- persisted EvidenceClaims can be indexed as embeddings
- semantic search returns related evidence
- existing ingestion behavior remains unchanged
```
