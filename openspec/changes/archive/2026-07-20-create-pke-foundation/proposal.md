## Why

Professional knowledge is currently described as a goal but has no executable local foundation. This change establishes the first working CLI, persistence, ingestion, and evidence model needed to turn Markdown career sources into structured, auditable knowledge.

## What Changes

- Add a TypeScript/Node.js project foundation with a CLI-first entry point.
- Add a `pke ingest <path>` command that ingests Markdown files, starting with `./examples/profiles/canonical-professional-profile-v1.md`.
- Add Docker Compose support for Postgres with pgvector enabled.
- Add Drizzle ORM configuration and initial database migrations.
- Introduce the initial canonical career domain model:
  - `SourceDocument`
  - `KnowledgeAsset`
  - `EvidenceClaim`
  - `SourceReference`
  - `Skill`
  - `Experience`
  - `Project`
  - `Achievement`
- Convert Markdown source content into a Canonical Career Document representation.
- Store extracted source metadata and raw source content for traceability.
- Add structured logging.
- Add OpenTelemetry hooks with minimal/no-op exporters for local development.
- Add a replaceable Langfuse abstraction/interface without requiring a live integration.
- Add focused tests for the Markdown ingestion pipeline.
- Add an example Markdown profile source and README documentation for local setup and the Postgres + pgvector choice.

## Capabilities

### New Capabilities

- `project-foundation`: TypeScript CLI project setup, local development scripts, documentation, logging, and observability extension points.
- `knowledge-persistence`: Postgres, pgvector, Drizzle migrations, and storage contracts for source documents, career knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements.
- `markdown-ingestion`: Markdown-only ingestion command that normalizes career source content into a Canonical Career Document and persists raw content, metadata, and traceable evidence.

### Modified Capabilities

- None.

## Impact

- Adds initial application source, CLI commands, tests, migrations, example input, and documentation.
- Adds local infrastructure requirements through Docker Compose for Postgres and pgvector.
- Introduces runtime dependencies for CLI parsing, database access, Markdown parsing, structured logging, and observability hooks.
- Defines the first persistence and ingestion contracts that future PDF, DOCX, LinkedIn, retrieval, and generation work will build on.
