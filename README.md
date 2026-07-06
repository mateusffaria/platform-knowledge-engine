# Professional Knowledge Engine

Professional Knowledge Engine is a local-first CLI for turning professional source material into structured, auditable career knowledge. The first supported workflow ingests Markdown, normalizes it into a Canonical Career Document, and stores raw source content plus evidence-backed career records in Postgres.

The core problem is not resume generation. The core problem is transforming heterogeneous professional sources into verified knowledge that future retrieval and generation workflows can cite.

## Current Scope

- TypeScript/Node.js CLI with a `pke` executable.
- Markdown ingestion through `pke ingest ./examples/profile.md`.
- Postgres plus pgvector local infrastructure with Docker Compose.
- Drizzle ORM schema and initial SQL migration.
- Canonical career model covering source documents, knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements.
- Structured logging, OpenTelemetry hooks, and a no-op Langfuse abstraction.

Out of scope for this foundation: PDF parsing, DOCX parsing, LinkedIn ingestion, resume generation, cover letter generation, full agent orchestration, hosted deployment, and LLM benchmarking.

## Requirements

- Node.js 22 or newer.
- npm 11 or newer.
- Docker with Docker Compose.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Start Postgres with pgvector:

   ```bash
   docker compose up -d postgres
   ```

4. Apply migrations:

   ```bash
   npm run db:migrate
   ```

   The initial SQL migration is also available under `drizzle/`.

5. Ingest the example profile:

   ```bash
   npm run pke -- ingest ./examples/profile.md
   ```

6. Run tests:

   ```bash
   npm test
   ```

## Configuration

Environment variables:

- `DATABASE_URL`: Postgres connection string. Defaults to `postgres://pke:pke@localhost:5432/pke`.
- `LOG_LEVEL`: structured log level. Defaults to `info`.
- `OTEL_ENABLED`: enables OpenTelemetry span creation when set to `true`.
- `LANGFUSE_ENABLED`: reserved for future real Langfuse integration. The current implementation remains no-op without credentials.

## Why Postgres + pgvector

Postgres is the career knowledge store and source of truth. It holds raw sources, canonical career records, evidence claims, and source references in relational tables where integrity and traceability can be enforced.

pgvector is included now because future hybrid retrieval will need vector search near the relational knowledge model. Vector search is a retrieval mechanism, not the source of truth. LLMs and embeddings must not create or authorize unverified career facts; generated outputs should trace back to persisted evidence claims.

## Ubiquitous Language

- **Source Document**: An ingested professional source such as a Markdown profile. It stores source type, path, metadata, raw content, and ingestion time.
- **Canonical Career Document**: The normalized representation produced from a source document before persistence.
- **Knowledge Asset**: A persisted, versionable unit of normalized career knowledge derived from a source document.
- **Evidence Claim**: A concrete claim extracted from source material, such as a skill, project, or achievement statement.
- **Source Reference**: The link from an evidence claim back to the source document section or location that supports it.
- **Skill**: A professional capability extracted from evidence.
- **Experience**: A role or work history entry extracted from evidence.
- **Project**: A named body of work extracted from evidence.
- **Achievement**: A result, outcome, or accomplishment extracted from evidence.
- **Hybrid Retrieval**: Future retrieval that combines relational filters, lexical search, and vector similarity.
- **Provider Boundary**: An interface that keeps replaceable services such as observability, embeddings, and LLMs from leaking into domain logic.

## Supported Markdown Shape

The deterministic parser supports frontmatter plus these top-level sections:

- `## Summary`
- `## Skills`
- `## Experience`
- `## Projects`
- `## Achievements`

Items should be written as bullet points. The parser preserves raw Markdown even when a future change needs richer extraction.
