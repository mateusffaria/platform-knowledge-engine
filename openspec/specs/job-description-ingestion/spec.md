# Job Description Ingestion Specification

## Purpose
Defines the required behavior for the `job-description-ingestion` capability.

## Requirements

### Requirement: Jobs module owns canonical job descriptions
The system SHALL provide a jobs module that owns job descriptions and job requirements without treating them as verified professional knowledge.

#### Scenario: Jobs module follows hexagonal boundaries
- **WHEN** the jobs module is inspected
- **THEN** it contains domain, application port/use-case, infrastructure, and CLI adapter boundaries consistent with the existing modular monolith

#### Scenario: Job descriptions are not professional evidence
- **WHEN** a job description is ingested
- **THEN** it is persisted as job-specific data
- **AND** it is not stored as a knowledge asset or evidence claim

#### Scenario: Retrieval infrastructure stays outside jobs application code
- **WHEN** imports under `src/modules/jobs/application` are inspected
- **THEN** they do not import retrieval infrastructure, database adapters, provider SDKs, or CLI code

### Requirement: Job descriptions can be ingested from Markdown and plain text
The system SHALL ingest local Markdown and plain-text job description files into a canonical Job Description model.

#### Scenario: Ingests Markdown job description
- **WHEN** the user runs `pke jobs ingest <file>` for a Markdown job description
- **THEN** the system parses the file and persists a Job Description record with source path, raw content, content hash, detected title when available, and ingestion timestamp

#### Scenario: Ingests plain text job description
- **WHEN** the user runs `pke jobs ingest <file>` for a plain-text job description
- **THEN** the system parses the file and persists a Job Description record with source path, raw content, content hash, detected title when available, and ingestion timestamp

#### Scenario: Rejects unsupported job source
- **WHEN** the user runs `pke jobs ingest <file>` for an unsupported source type
- **THEN** the command fails with an actionable validation error before persisting a job description

#### Scenario: Empty job description is rejected
- **WHEN** the parser receives an empty or whitespace-only job description
- **THEN** ingestion fails with an actionable validation error before persisting a job description

### Requirement: Job requirements are extracted with canonical types and importance
The system SHALL extract Job Requirement records with canonical requirement type and importance values.

#### Scenario: Supported requirement types are assigned
- **WHEN** a job requirement is extracted
- **THEN** its type is one of `skill`, `technology`, `experience`, `responsibility`, `seniority`, `domain`, `education`, or `language`

#### Scenario: Required requirements are distinguished
- **WHEN** a bullet appears under a required, requirements, qualifications, responsibilities, or equivalent mandatory section
- **THEN** the extracted requirement importance is `required`

#### Scenario: Preferred requirements are distinguished
- **WHEN** a bullet appears under a nice-to-have, preferred qualifications, bonus, or equivalent optional section
- **THEN** the extracted requirement importance is `preferred`

#### Scenario: Inferred requirements are explicit
- **WHEN** requirement type, importance, or normalized value is inferred from deterministic text rules rather than an explicit section or phrase
- **THEN** the extracted requirement importance or inference metadata marks the requirement as `inferred`
- **AND** the original text is preserved

### Requirement: Requirement extraction preserves provenance
The system SHALL preserve source provenance for every extracted Job Requirement.

#### Scenario: Requirement stores source excerpt
- **WHEN** a requirement is extracted from a bullet or paragraph
- **THEN** the requirement stores the source excerpt that caused the extraction

#### Scenario: Requirement stores source location
- **WHEN** a requirement is extracted from a job description
- **THEN** the requirement stores a source location such as a line number or line range

#### Scenario: Requirement stores section context
- **WHEN** a requirement is extracted from a detected section
- **THEN** the requirement stores the original section label or equivalent section context

### Requirement: Deterministic parser detects common job sections
The system SHALL deterministically detect common job description sections and classify extracted items using section context.

#### Scenario: Requirements section is detected
- **WHEN** a job description contains an explicit Requirements or Qualifications section with bullet points
- **THEN** each requirement-like bullet in that section is extracted as a required requirement

#### Scenario: Responsibilities section is detected
- **WHEN** a job description contains an explicit Responsibilities section with bullet points
- **THEN** each responsibility-like bullet in that section is extracted as a responsibility requirement

#### Scenario: Preferred section is detected
- **WHEN** a job description contains a Nice to have or Preferred qualifications section with bullet points
- **THEN** each requirement-like bullet in that section is extracted as a preferred requirement

#### Scenario: Unmatched text remains available
- **WHEN** a bullet or paragraph cannot be normalized to a specific canonical requirement value
- **THEN** its original text remains persisted for semantic retrieval rather than being discarded

### Requirement: Job ingestion is persisted and retrievable
The system SHALL persist job descriptions and requirements so they can be shown and used by later commands.

#### Scenario: Job description requirements are saved atomically
- **WHEN** job ingestion succeeds
- **THEN** the job description and its extracted requirements are persisted together

#### Scenario: Job show displays canonical job model
- **WHEN** the user runs `pke jobs show <job-id>`
- **THEN** the command displays the job description identity, source path, detected title, and extracted requirements grouped or labeled by type and importance

#### Scenario: Job show supports machine-readable output
- **WHEN** the user runs `pke jobs show <job-id> --json`
- **THEN** the command prints the persisted job description and requirements as machine-readable JSON

#### Scenario: Missing job is reported clearly
- **WHEN** the user runs `pke jobs show <job-id>` for an unknown job id
- **THEN** the command fails with an actionable not-found error

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
