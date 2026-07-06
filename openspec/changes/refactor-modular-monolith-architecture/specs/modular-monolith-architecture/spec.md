## ADDED Requirements

### Requirement: Capability-based source organization
The system SHALL organize runtime source code by business capability and shared foundations rather than only by technical layer.

#### Scenario: Source tree exposes capability modules
- **WHEN** a developer inspects the `src/` tree after the refactor
- **THEN** the tree contains `shared/` foundations and `modules/` for ingestion, knowledge, retrieval, jobs, and documents

#### Scenario: Shared foundations are separated from business modules
- **WHEN** configuration, database setup, logging, or observability utilities are used by multiple capabilities
- **THEN** those utilities reside under `src/shared/` and are imported as shared foundations

### Requirement: Hexagonal module boundaries
Each business module SHALL separate domain, application, infrastructure, and interface concerns according to hexagonal architecture.

#### Scenario: Domain remains independent
- **WHEN** domain code is imported or tested
- **THEN** it has no dependencies on application code, infrastructure adapters, CLI code, database clients, LLM providers, telemetry clients, or external SDKs

#### Scenario: Application uses ports for external effects
- **WHEN** application use cases need persistence, parsing, rendering, retrieval, telemetry, or provider behavior
- **THEN** they depend on explicit application ports rather than concrete infrastructure implementations

#### Scenario: Infrastructure implements ports
- **WHEN** an adapter talks to Drizzle, the filesystem, parsers, embedding providers, vector stores, or other external systems
- **THEN** it lives in module infrastructure or shared infrastructure and implements an application port

### Requirement: CLI calls application use cases only
The CLI SHALL invoke module application use cases through interface or composition code and MUST NOT call repositories, database clients, parsers, telemetry clients, or providers directly from command handlers.

#### Scenario: Ingest command dependency path
- **WHEN** `pke ingest ./examples/profile.md` is executed
- **THEN** the command path delegates to the ingestion application use case and infrastructure is accessed through ports

#### Scenario: CLI behavior is preserved
- **WHEN** the existing Markdown profile example is ingested through the CLI
- **THEN** the command succeeds with the same user-visible behavior as before the refactor

### Requirement: Cross-module access through explicit contracts
Modules SHALL collaborate through explicit application services or ports and MUST NOT import another module's infrastructure directly.

#### Scenario: Ingestion persists knowledge
- **WHEN** ingestion stores canonical career knowledge
- **THEN** it uses a knowledge persistence port or application service instead of importing a knowledge infrastructure repository directly

#### Scenario: Future retrieval or document modules need knowledge
- **WHEN** retrieval or document generation needs career knowledge
- **THEN** access occurs through knowledge application contracts rather than database tables or repository implementations

### Requirement: Database and migrations remain compatible
The refactor SHALL preserve existing Drizzle schema behavior and migration compatibility.

#### Scenario: Migration tooling loads schema
- **WHEN** Drizzle migration tooling or project scripts load the configured schema
- **THEN** they resolve the schema successfully from the refactored layout or a compatibility export

#### Scenario: Existing persisted model remains stable
- **WHEN** Markdown ingestion persists a canonical career document after the refactor
- **THEN** it writes the same categories of source documents, knowledge assets, references, evidence claims, skills, experiences, projects, and achievements as before

### Requirement: Architecture is documented
The architecture refactor SHALL be documented in project documentation and an ADR.

#### Scenario: Developer reads project documentation
- **WHEN** a developer reads README or architecture documentation
- **THEN** it explains the modular monolith layout, the module dependency rules, and how CLI commands are expected to call application use cases

#### Scenario: Developer reads the ADR
- **WHEN** a developer reads the architecture decision record
- **THEN** it explains why modular monolith plus hexagonal architecture was chosen and lists the relevant trade-offs and non-goals

### Requirement: Ingestion use case is tested through ports
The ingestion module SHALL include tests proving the ingestion use case works through ports while preserving existing Markdown ingestion behavior.

#### Scenario: Ingestion use case receives fake adapters
- **WHEN** the ingestion use case is tested with in-memory or recording port implementations
- **THEN** it parses and persists evidence-backed canonical career records without requiring direct database access

#### Scenario: Existing Markdown ingestion tests remain valid
- **WHEN** the test suite runs after the refactor
- **THEN** the existing Markdown profile parsing and ingestion expectations continue to pass
