## Context

Professional Knowledge Engine is starting from an OpenSpec planning skeleton with no application code yet. The first implementation must establish a local-first CLI application that can ingest Markdown career sources, preserve raw source evidence, normalize content into an auditable canonical career model, and prepare for future hybrid retrieval without making vector search the source of truth.

The project thesis is that generated career outputs must be composed from verified evidence rather than invented facts. This foundation therefore prioritizes traceability, replaceable provider boundaries, and a relational knowledge store before richer parsing, retrieval, or document generation.

## Goals / Non-Goals

**Goals:**

- Create a TypeScript/Node.js CLI project with a working `pke ingest ./examples/profiles/canonical-professional-profile-v1.md` path.
- Run locally with Docker Compose Postgres and pgvector.
- Use Drizzle ORM for schema definition, migrations, and typed database access.
- Persist Markdown source metadata, raw content, canonical career records, evidence claims, and source references.
- Make observability replaceable through structured logging, OpenTelemetry hooks, and a Langfuse interface.
- Provide focused tests for Markdown parsing, canonical document creation, and persistence orchestration.

**Non-Goals:**

- PDF, DOCX, LinkedIn, or other non-Markdown ingestion.
- Resume, cover letter, evidence pack, or job-specific output generation.
- Full agent orchestration or LLM-driven extraction.
- Production deployment, hosted infrastructure, Grafana, VictoriaLogs, or real telemetry exporters.
- Automated LLM benchmarking.

## Decisions

1. Use a CLI-first TypeScript package.

   The initial user workflow is local ingestion, so the project should expose a `pke` binary and organize source under a small application boundary such as `src/cli`, `src/ingestion`, `src/domain`, `src/db`, and `src/observability`. A web server would add surface area before there is a stable knowledge model.

   Alternative considered: expose ingestion through an HTTP API first. That would be useful later, but it makes local setup and testing heavier for the initial change.

2. Use Postgres with pgvector as local infrastructure from day one.

   The relational store will hold source documents, canonical career entities, evidence claims, and source references. pgvector is included now to keep the storage platform aligned with future hybrid retrieval, but this change does not need to generate embeddings or make vectors authoritative.

   Alternative considered: start with SQLite. SQLite would simplify setup, but it would defer pgvector integration and create an early migration away from the intended storage model.

3. Use Drizzle ORM migrations as the database contract.

   Drizzle keeps schema definitions close to TypeScript code while producing explicit migrations that can be reviewed and applied locally. The first migration should create tables and relationships for source documents, knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements.

   Alternative considered: hand-written SQL only. That is transparent, but it reduces type-level feedback inside the application code.

4. Treat Markdown ingestion as deterministic extraction into a Canonical Career Document.

   The first ingestion flow should parse Markdown structure and frontmatter where present, preserve raw content, and map recognizable sections into a Canonical Career Document representation. It must not rely on LLM inference to create facts in this change.

   Alternative considered: call an LLM to extract structured facts immediately. That conflicts with the initial traceability requirement unless provider, validation, and observability boundaries are already mature.

5. Model evidence explicitly.

   Source references should point from extracted evidence claims back to source document locations or section identifiers. Career entities such as skills, experiences, projects, and achievements should be tied to knowledge assets and evidence claims so future generated outputs can cite evidence instead of free-floating assertions.

   Alternative considered: persist only the normalized career entities. That would be simpler, but it would lose the audit trail required by the project thesis.

6. Add observability seams without requiring external services.

   Structured logs should work locally by default. OpenTelemetry should be initialized with no-op or console-safe defaults, and Langfuse should be represented by an interface plus disabled/no-op implementation. Real exporters can be added later without changing ingestion code.

   Alternative considered: wire real Langfuse and telemetry exporters now. That would make local setup brittle and expand scope beyond the foundation.

## Risks / Trade-offs

- [Risk] Markdown structure varies widely across user profiles -> Mitigation: document the supported example structure, preserve raw content, and make parser output explicit enough to improve iteratively.
- [Risk] Initial canonical model may be incomplete -> Mitigation: keep domain records normalized, evidence-backed, and migration-controlled so later changes can add fields and entities.
- [Risk] pgvector is included before embeddings exist -> Mitigation: document that pgvector prepares retrieval infrastructure but vectors are not the source of truth.
- [Risk] Observability abstractions could become empty ceremony -> Mitigation: keep interfaces minimal and call them only at ingestion boundaries where they provide useful events later.
- [Risk] Database-dependent tests can be slow or flaky -> Mitigation: separate pure Markdown parser tests from persistence integration tests and keep integration setup documented.

## Migration Plan

1. Add project configuration, package scripts, TypeScript build/test tooling, and CLI binary wiring.
2. Add Docker Compose with Postgres and pgvector plus environment configuration for local database access.
3. Add Drizzle schema definitions and generate the initial migration.
4. Implement domain types and Markdown ingestion pipeline.
5. Implement persistence repositories or services that save source documents, canonical records, evidence claims, and references transactionally.
6. Add logging, OpenTelemetry initialization, and Langfuse no-op interface.
7. Add tests, example Markdown input, and README setup documentation.

Rollback for this initial change is removing the newly added application files, migrations, and Docker Compose configuration before any production deployment exists.

## Open Questions

- The exact Canonical Career Document field names can be refined during implementation, but they must cover the initial domain entities and preserve source references.
- The Markdown example format should be treated as the supported contract for this change; broader Markdown patterns can be proposed after the first parser is working.
