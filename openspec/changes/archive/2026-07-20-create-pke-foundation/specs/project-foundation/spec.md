## ADDED Requirements

### Requirement: CLI project foundation
The system SHALL provide a TypeScript/Node.js CLI application with a `pke` executable entry point and local development scripts for building, testing, and running the application.

#### Scenario: CLI help is available
- **WHEN** a developer runs the CLI without a valid command or with a help flag
- **THEN** the system displays available commands including `ingest`

#### Scenario: Project scripts are available
- **WHEN** a developer installs dependencies
- **THEN** the package scripts include commands for building, testing, and running the CLI locally

### Requirement: Local configuration documentation
The system SHALL document the project purpose, local setup steps, required environment variables, and the reason Postgres with pgvector is used for the local knowledge store.

#### Scenario: Developer reads setup documentation
- **WHEN** a developer opens the README
- **THEN** the documentation explains how to start infrastructure, run migrations, execute `pke ingest ./examples/profiles/canonical-professional-profile-v1.md`, and run tests

#### Scenario: Storage choice is documented
- **WHEN** a developer reviews the README
- **THEN** the documentation explains that Postgres is the source of truth and pgvector is included for future retrieval rather than authoritative career facts

#### Scenario: Glossary is documented
- **WHEN** a developer reviews the README
- **THEN** the documentation explains all terminology used in the project for Ubiquitous Language as recommended in DDD(Domain Driven Desing) concept

### Requirement: Structured local observability
The system SHALL emit structured logs for CLI execution and ingestion boundaries, initialize OpenTelemetry hooks with minimal local-safe exporters, and expose a Langfuse abstraction that can run as a no-op implementation.

#### Scenario: Ingestion emits structured events
- **WHEN** the ingest command processes a Markdown source
- **THEN** the system emits structured log events for command start, source parsing, persistence completion, and failures

#### Scenario: External observability services are optional
- **WHEN** Langfuse or telemetry exporter credentials are absent
- **THEN** the system runs successfully with no-op observability implementations
