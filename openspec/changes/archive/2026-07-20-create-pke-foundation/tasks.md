## 1. Project Setup

- [x] 1.1 Create TypeScript/Node.js package configuration with a `pke` binary entry point.
- [x] 1.2 Add TypeScript, build, lint or typecheck, and test tooling scripts.
- [x] 1.3 Create initial source layout for CLI, domain, ingestion, database, and observability modules.
- [x] 1.4 Add environment configuration loading for local database and observability settings.

## 2. Local Infrastructure

- [x] 2.1 Add Docker Compose configuration for Postgres with pgvector available.
- [x] 2.2 Add Drizzle configuration and database connection module.
- [x] 2.3 Define Drizzle schema for source documents, knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements.
- [x] 2.4 Generate and commit the initial migration that creates the knowledge schema and pgvector extension.
- [x] 2.5 Add a migration command or documented workflow for applying local migrations.

## 3. Domain Model

- [x] 3.1 Define TypeScript domain types for `SourceDocument`, `KnowledgeAsset`, `EvidenceClaim`, `SourceReference`, `Skill`, `Experience`, `Project`, and `Achievement`.
- [x] 3.2 Define the Canonical Career Document representation for Markdown ingestion output.
- [x] 3.3 Add validation or construction helpers that require persisted career facts to carry source evidence.

## 4. Markdown Ingestion

- [x] 4.1 Add an example Markdown source at `examples/profile.md`.
- [x] 4.2 Implement Markdown file validation for existing `.md` or `.markdown` files.
- [x] 4.3 Implement deterministic Markdown parsing for supported profile sections.
- [x] 4.4 Map parsed Markdown sections into the Canonical Career Document representation.
- [x] 4.5 Generate evidence claims and source references for extracted skills, experiences, projects, and achievements.
- [x] 4.6 Preserve raw Markdown content and extracted source metadata for storage.

## 5. Persistence Flow

- [x] 5.1 Implement repositories or persistence services for source documents and canonical career records.
- [x] 5.2 Persist source document metadata and raw content during ingestion.
- [x] 5.3 Persist knowledge assets, evidence claims, source references, and extracted career entities transactionally.
- [x] 5.4 Ensure persistence rejects or prevents career records that do not have evidence claims and source references.

## 6. CLI and Observability

- [x] 6.1 Implement CLI help and command registration that exposes `ingest`.
- [x] 6.2 Implement `pke ingest <path>` to run the Markdown ingestion and persistence pipeline.
- [x] 6.3 Add structured logging for command start, parsing, persistence completion, and failures.
- [x] 6.4 Add OpenTelemetry initialization with local-safe no-op or minimal exporters.
- [x] 6.5 Add a Langfuse interface and no-op implementation that does not require credentials.

## 7. Tests and Documentation

- [x] 7.1 Add parser tests covering `examples/profile.md` and Canonical Career Document output.
- [x] 7.2 Add tests for missing-file and unsupported-file CLI error paths.
- [x] 7.3 Add ingestion or persistence orchestration tests verifying evidence-linked career records.
- [x] 7.4 Add README documentation for project purpose, local setup, migrations, `pke ingest ./examples/profile.md`, and tests.
- [x] 7.5 Document why Postgres is the source of truth and pgvector is included for future retrieval rather than authoritative career facts.
