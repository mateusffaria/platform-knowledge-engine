## ADDED Requirements

### Requirement: Job retrieval intent is built from persisted requirements
The system SHALL build a deterministic retrieval intent from a persisted job description and its requirements.

#### Scenario: Builds intent for known job
- **WHEN** `BuildJobRetrievalIntent` receives a persisted job id
- **THEN** it returns an intent containing the job id, source requirement ids, PKQL-compatible query text, semantic text, and warnings

#### Scenario: Missing job cannot build intent
- **WHEN** `BuildJobRetrievalIntent` receives an unknown job id
- **THEN** it fails with an actionable not-found error before calling retrieval

#### Scenario: Intent generation is deterministic
- **WHEN** the same persisted job requirements are used to build an intent multiple times
- **THEN** the structured terms, semantic text, query string, and warnings are produced in stable order

### Requirement: Retrieval intent uses canonical PKQL fields
The system SHALL map normalized job requirements to supported canonical PKQL fields when a precise mapping exists.

#### Scenario: Skill requirement maps to skill filter
- **WHEN** a persisted requirement has type `skill` and a normalized value
- **THEN** the retrieval intent includes a `skill` PKQL filter or structured term for that normalized value

#### Scenario: Technology requirement maps to technology filter
- **WHEN** a persisted requirement has type `technology` and a normalized value
- **THEN** the retrieval intent includes a `technology` PKQL filter or structured term for that normalized value

#### Scenario: Role-like seniority maps only when supported
- **WHEN** a persisted requirement has type `seniority` and can be represented by a supported canonical role value
- **THEN** the retrieval intent may include a `role` PKQL filter or structured term for that value

#### Scenario: Unsupported requirement value remains semantic
- **WHEN** a persisted requirement cannot be represented by a supported canonical PKQL field
- **THEN** the retrieval intent preserves the requirement text in semantic retrieval text
- **AND** it does not emit an unsupported PKQL filter

### Requirement: Retrieval intent respects requirement importance
The system SHALL preserve required, preferred, and inferred requirement importance when building retrieval intent.

#### Scenario: Required requirements are prioritized
- **WHEN** an intent is built from required and preferred requirements
- **THEN** required requirements appear before preferred requirements in deterministic structured and semantic intent components

#### Scenario: Preferred requirements remain included
- **WHEN** an intent is built from preferred requirements
- **THEN** preferred requirements contribute to retrieval intent without being treated as mandatory evidence filters

#### Scenario: Inferred requirements are traceable
- **WHEN** an intent includes an inferred requirement
- **THEN** the intent identifies the source requirement as inferred so downstream output can explain the signal if needed

### Requirement: Job retrieval reuses hybrid retrieval contracts
The system SHALL execute job-specific retrieval through existing retrieval application contracts and return an Evidence Pack.

#### Scenario: Job retrieve returns Evidence Pack
- **WHEN** the user runs `pke jobs retrieve <job-id>`
- **THEN** the command builds a job retrieval intent, calls the hybrid retrieval use case with the generated query, and prints a ranked Evidence Pack

#### Scenario: Job retrieve supports JSON output
- **WHEN** the user runs `pke jobs retrieve <job-id> --json`
- **THEN** the command prints the complete Evidence Pack as machine-readable JSON

#### Scenario: Job retrieve supports retrieval options
- **WHEN** the user runs `pke jobs retrieve <job-id>` with `--limit`, `--min-score`, `--claim-status`, `--subject-type`, or `--verbose`
- **THEN** the command validates those options and passes supported retrieval options to the hybrid retrieval use case

#### Scenario: Existing retrieval behavior is unchanged
- **WHEN** the user runs existing `pke retrieve "<query>"` or `pke search "<query>"` commands
- **THEN** those commands keep their existing behavior and output contracts

### Requirement: Jobs module does not own Evidence Pack generation
The system SHALL keep Evidence Pack generation, ranking, deduplication, and retrieval strategy execution owned by the retrieval module.

#### Scenario: Jobs application emits retrieval intent only
- **WHEN** jobs application use cases are inspected
- **THEN** they build and return retrieval intent data rather than ranking evidence or constructing Evidence Packs

#### Scenario: Retrieval owns Evidence Pack semantics
- **WHEN** `pke jobs retrieve <job-id>` produces an Evidence Pack
- **THEN** Evidence Item scoring, warnings, strategy selection, deduplication, and trusted-evidence eligibility come from retrieval module behavior

### Requirement: Job retrieval behavior is documented
The system SHALL document the job ingestion and job retrieval workflow.

#### Scenario: Architecture documentation describes job flow
- **WHEN** architecture documentation is inspected
- **THEN** it describes Job Source, Job Parser, Canonical Job Model, Job Requirements, Retrieval Intent, Hybrid Retrieval, and Evidence Pack ownership

#### Scenario: Roadmap documentation mentions job ingestion milestone
- **WHEN** roadmap documentation is inspected after implementation
- **THEN** it includes the canonical job description ingestion and retrieval-intent milestone status and documented limitations
