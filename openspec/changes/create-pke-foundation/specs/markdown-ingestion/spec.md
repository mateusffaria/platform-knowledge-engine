## ADDED Requirements

### Requirement: Markdown ingest command
The system SHALL provide a CLI command `pke ingest <path>` that accepts a Markdown file path and runs the Markdown ingestion pipeline.

#### Scenario: Example profile is ingested
- **WHEN** a developer runs `pke ingest ./examples/profile.md`
- **THEN** the system parses the Markdown file, persists the source document and derived career knowledge, and reports a successful ingestion result

#### Scenario: Missing file fails clearly
- **WHEN** a developer runs `pke ingest` with a path that does not exist
- **THEN** the system exits with a non-zero status and reports that the source file could not be found

#### Scenario: Unsupported file type fails clearly
- **WHEN** a developer runs `pke ingest` with a non-Markdown file
- **THEN** the system exits with a non-zero status and reports that only Markdown ingestion is supported in this change

### Requirement: Canonical Career Document conversion
The system SHALL convert supported Markdown profile content into a Canonical Career Document representation before persistence.

#### Scenario: Markdown sections become canonical fields
- **WHEN** the Markdown source contains supported sections for skills, experience, projects, or achievements
- **THEN** the parser maps those sections into the corresponding Canonical Career Document fields

#### Scenario: Raw content is preserved
- **WHEN** the Markdown source is converted into a Canonical Career Document
- **THEN** the original Markdown content remains available for persistence and audit

### Requirement: Deterministic evidence extraction
The Markdown ingestion pipeline SHALL create evidence claims and source references from parsed Markdown content without using an LLM to invent or infer unsupported career facts.

#### Scenario: Evidence references source location
- **WHEN** the pipeline extracts a claim from a Markdown section
- **THEN** the claim includes a source reference identifying the originating document and section or location

#### Scenario: Unsupported ambiguity is not invented
- **WHEN** the Markdown source omits a detail such as dates, employer, or technology names
- **THEN** the system does not fabricate that missing detail in the Canonical Career Document

### Requirement: Markdown ingestion tests
The system SHALL include automated tests for the Markdown ingestion pipeline.

#### Scenario: Parser test covers example profile
- **WHEN** the test suite runs
- **THEN** it verifies that `examples/profile.md` is converted into the expected Canonical Career Document shape

#### Scenario: Persistence orchestration test covers evidence
- **WHEN** the ingestion pipeline is tested
- **THEN** it verifies that persisted career records are associated with evidence claims and source references
