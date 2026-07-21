## ADDED Requirements

### Requirement: Job ingestion persists atomic components beneath canonical requirements
The jobs module SHALL persist ordered atomic components together with every newly ingested deterministic parent `JobRequirement`. Parent and component writes MUST be atomic, and the parent identity, original text, and provenance MUST remain the canonical job-source record.

#### Scenario: Compound requirement is ingested
- **WHEN** ingestion extracts “Strong knowledge of Go and PostgreSQL” as one parent requirement and validates two atomic components
- **THEN** the transaction persists the unchanged parent plus ordered Go and PostgreSQL child components

#### Scenario: Non-compound requirement is ingested
- **WHEN** ingestion extracts a requirement with no supported independent coordination
- **THEN** the transaction persists the parent plus one singleton component

#### Scenario: Component validation fails
- **WHEN** a proposed component lacks a valid parent source span, canonical classification, or unique deterministic identity
- **THEN** ingestion fails before persisting a partial parent/component graph

### Requirement: Persisted job output exposes component traceability
The system SHALL return atomic component identity, canonical fields, parent linkage, source order, and provenance in machine-readable job reads and SHALL show the component breakdown for compound requirements in human-readable diagnostic output.

#### Scenario: Job JSON is requested
- **WHEN** the user runs `pke jobs show <job-id> --json` for a component-aware job
- **THEN** each parent requirement includes its ordered component collection and provenance

#### Scenario: Legacy job is shown
- **WHEN** the user shows a persisted job with no stored components
- **THEN** output includes its deterministic singleton component adaptation without mutating storage
