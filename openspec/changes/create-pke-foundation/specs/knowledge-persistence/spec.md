## ADDED Requirements

### Requirement: Local database infrastructure
The system SHALL provide Docker Compose configuration for a local Postgres database with pgvector available.

#### Scenario: Database starts locally
- **WHEN** a developer starts the documented Docker Compose services
- **THEN** Postgres is available for the application and supports the pgvector extension

### Requirement: Drizzle-managed schema
The system SHALL define the initial persistence schema with Drizzle ORM and provide database migrations for the canonical career knowledge model.

#### Scenario: Migrations create the knowledge schema
- **WHEN** a developer applies the initial migrations to an empty local database
- **THEN** tables exist for source documents, knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements

#### Scenario: Domain relationships preserve traceability
- **WHEN** career entities are persisted
- **THEN** the database can associate them with knowledge assets, evidence claims, and source references back to source documents

### Requirement: Source document storage
The system SHALL persist source document metadata and raw content before or with derived career knowledge.

#### Scenario: Markdown source is stored
- **WHEN** a Markdown file is ingested
- **THEN** the system stores its source type, path or identifier, extracted metadata, raw Markdown content, and ingestion timestamp

### Requirement: Evidence-backed career records
The system SHALL persist extracted skills, experiences, projects, and achievements as career records that are traceable to evidence claims and source references.

#### Scenario: Extracted fact has evidence
- **WHEN** the ingestion pipeline stores a career fact from Markdown
- **THEN** the stored fact is linked to at least one evidence claim and source reference

#### Scenario: Unverified generated facts are rejected
- **WHEN** application code attempts to persist a generated career fact without source evidence
- **THEN** the system prevents or fails that persistence path
