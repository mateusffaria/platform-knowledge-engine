## ADDED Requirements

### Requirement: Analyze a persisted canonical job description
The system SHALL provide `pke jobs analyze <job-id>` to analyze an existing canonical job description and produce a validated `JobAnalysis` without rerunning or changing deterministic job ingestion.

#### Scenario: Analyze an existing job
- **WHEN** a user runs `pke jobs analyze <job-id>` for a persisted job and valid LLM configuration is available
- **THEN** the system loads the canonical job description and deterministic requirements, invokes the Job Analyzer, validates the result, persists a separate analysis snapshot, and reports it

#### Scenario: Analyze a missing job
- **WHEN** a user runs `pke jobs analyze <job-id>` for an unknown job identifier
- **THEN** the system reports that the job description was not found and does not call the LLM provider

### Requirement: Preserve deterministic and inferred requirements separately
The Job Analyzer SHALL treat the canonical `JobDescription` and deterministic `JobRequirement` records as immutable source authority. Agent-inferred requirements MUST be stored in `JobAnalysis`, MUST be marked `inferred: true`, and MUST NOT be written into or replace deterministic requirement records.

#### Scenario: Analysis identifies an implicit requirement
- **WHEN** the analyzer identifies an implicit requirement not deterministically extracted from the source
- **THEN** the persisted analysis records it as an inferred requirement separate from canonical requirements

#### Scenario: Analysis conflicts with explicit source material
- **WHEN** an inferred observation differs from or is unsupported by explicit deterministic source material
- **THEN** the canonical job model remains unchanged and the analysis records an ambiguity or warning rather than resolving the conflict

### Requirement: Structured, source-aware job analysis
The analyzer output SHALL be schema-validated before use and SHALL support inferred requirements, seniority signals, domain signals, cross-team leadership signals, architecture and reliability expectations, ambiguities, and warnings. Each analysis signal MUST preserve a job-source excerpt and/or source location when the analyzer can identify one.

#### Scenario: Valid structured analysis
- **WHEN** the LLM returns output that conforms to the job-analysis schema
- **THEN** the system creates a typed `JobAnalysis` containing its categorized signals and source references where supplied

#### Scenario: Invalid structured analysis
- **WHEN** the LLM returns non-JSON output or output that fails the job-analysis schema
- **THEN** the system rejects the result, persists no new analysis, and preserves the canonical job and previously persisted analyses

### Requirement: Separate analysis persistence and selection
The system SHALL persist each successful analysis as a separate immutable snapshot linked to its job description, including provider, effective model, prompt version, and creation time. Retrieval-intent construction MUST use the most recent valid analysis when one exists.

#### Scenario: Reanalysis succeeds
- **WHEN** a user analyzes a job that already has a successful analysis
- **THEN** the system preserves the prior snapshot and persists a new snapshot as the latest analysis

#### Scenario: No analysis exists
- **WHEN** a retrieval intent is built for a job with no successful analysis
- **THEN** the system builds the deterministic retrieval intent without requiring LLM configuration

### Requirement: Analysis-informed retrieval intent
The system SHALL allow the latest valid analysis to add explicitly inferred semantic signals to a job retrieval intent while retaining deterministic canonical requirements as authoritative for ordering and PKQL filters. The retrieval intent MUST identify inferred contributions and warn when they are included.

#### Scenario: Analysis enriches an intent
- **WHEN** a job has a valid latest analysis containing inferred requirements or signals
- **THEN** the retrieval intent includes the eligible inferred text as lower-priority semantic enrichment and identifies its inferred analysis provenance

#### Scenario: Evidence Pack remains bounded
- **WHEN** an analysis-informed retrieval intent is passed to hybrid retrieval
- **THEN** hybrid retrieval continues to return a traceable Evidence Pack and the Job Analyzer has not modified any professional EvidenceClaim

### Requirement: Analysis command output
The analyze command SHALL support `--json` for the complete machine-readable result and `--verbose` for provider, model, prompt-version, and source-reference diagnostics.

#### Scenario: JSON output is requested
- **WHEN** a user supplies `pke jobs analyze <job-id> --json`
- **THEN** the command prints the validated persisted analysis as JSON

#### Scenario: Verbose output is requested
- **WHEN** a user supplies `pke jobs analyze <job-id> --verbose`
- **THEN** the command prints analysis provenance and execution metadata in addition to the normal summary
