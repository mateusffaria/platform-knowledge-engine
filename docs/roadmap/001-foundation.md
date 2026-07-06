# AEM-001 — Foundation

## Goal

Build the technical foundation of the Professional Knowledge Engine.

## Problem

Before the system can generate any professional artifact, it needs a reliable way to ingest and persist professional knowledge.

Professional data is usually fragmented across resumes, LinkedIn profiles and personal notes. The first milestone focuses only on proving that one source can be ingested and persisted.

## Scope

- CLI application
- PostgreSQL
- pgvector availability
- Drizzle ORM
- Docker Compose
- Markdown ingestion
- Canonical Career Model
- structured logging
- OpenTelemetry hooks
- Langfuse abstraction
- basic tests

## Out of Scope

- PDF parsing
- DOCX parsing
- LinkedIn parsing
- semantic search
- agents
- resume generation
- benchmarking
- real Langfuse integration

## Architectural Decisions

### Local-first

The project starts as a local-first CLI application.

This keeps operational complexity low and makes the project easy to run from a developer machine.

### PostgreSQL as Source of Truth

PostgreSQL stores the structured professional knowledge.

The database is the source of truth. LLM prompts and vector indexes are not.

### pgvector from day one

pgvector is included early to support future semantic retrieval without adding a separate vector database.

### Markdown as first source

Markdown is simple, readable and easy to parse.

It allows the project to validate the ingestion pipeline without dealing with PDF and DOCX complexity too early.

## Acceptance Criteria

- The project runs locally.
- Database migrations work.
- A Markdown source can be ingested.
- Knowledge is persisted.
- Tests pass.

## Risks

- The initial model may be too simple.
- Markdown ingestion may hide complexities that appear later with PDF/DOCX.
- Early abstractions may need to be revisited.

## Next Milestone

AEM-002 — Architecture First.
