# ADR 0001: Modular Monolith with Hexagonal Architecture

## Status

Accepted

## Context

Professional Knowledge Engine is a local-first CLI that turns professional source material into structured, auditable career knowledge. The first workflow ingests Markdown, normalizes it into a Canonical Career Document, and persists source content plus evidence-backed career records in Postgres.

The initial codebase was organized mostly by technical layer: CLI, ingestion, domain, database, and observability. That was simple for one ingestion path, but it made it easy for command handlers, repositories, parsers, telemetry, and business rules to couple together as new capabilities such as retrieval, jobs, and document generation are added.

## Decision

Use a modular monolith organized by business capability:

- ingestion
- knowledge
- retrieval
- jobs
- documents
- shared foundations

Inside each capability, use hexagonal architecture:

- Domain code contains business types and invariants.
- Application use cases orchestrate workflows and depend on ports.
- Application ports define contracts for external effects.
- Infrastructure adapters implement ports with databases, parsers, SDKs, providers, or filesystems.
- CLI interfaces translate command input into application calls.

The top-level CLI remains the executable command registry, while command behavior is delegated to module interfaces and production wiring stays behind module boundaries.

## Alternatives Considered

### Keep technical-layer folders

Keeping `src/cli`, `src/db`, `src/domain`, `src/ingestion`, and `src/observability` would reduce near-term churn, but it would not make business ownership or dependency direction clear as the project grows.

### Split into microservices

Microservices would add deployment, networking, observability, data consistency, and operational overhead before the domain model is stable. The project is local-first and CLI-first, so service boundaries are premature.

### Add a dependency injection framework

A framework could centralize wiring, but the current project can keep composition explicit with simple factories and adapters. Avoiding a framework keeps the architecture visible and easy to test.

## Consequences

Positive consequences:

- Business capabilities have clear ownership.
- Domain code is easier to test because it is isolated from infrastructure.
- Application use cases can be tested through in-memory or recording ports.
- CLI commands can stay stable while infrastructure changes behind module boundaries.
- Future parsers, retrieval providers, and document renderers have explicit extension points.

Trade-offs:

- File moves create import churn.
- The codebase has more folders than a technical-layer layout.
- Boundary discipline must be maintained through reviews, tests, and documentation.

## Non-Goals

This decision does not introduce microservices, an HTTP API, new source parsers, resume generation, full hybrid retrieval, real Langfuse integration, or automated benchmarking.
