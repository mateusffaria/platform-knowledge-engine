# Job Analysis Agent Specification

## Purpose
Defines the required behavior for the `job-analysis-agent` capability.

## Requirements

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

### Requirement: Conservative inference boundary
The Job Analyzer SHALL emit only the narrowest inference directly supported by the supplied canonical job source and deterministic requirements. It MUST prefer omission over an unsupported competency or broader interpretation. A source reference MUST NOT by itself make an inference valid, and a warning or ambiguity MUST NOT be used to retain clearly unsupported output.

#### Scenario: Ambiguous wording does not create stakeholder management
- **WHEN** a job source contains ambiguous coordination or communication wording without evidence of stakeholder-management responsibility
- **THEN** the analysis omits stakeholder-management and any other unsupported competency while retaining a bounded ambiguity or warning when useful

#### Scenario: Source reference does not validate overreach
- **WHEN** an analyzer output attaches a valid source excerpt to a competency that does not follow from that excerpt
- **THEN** the system rejects or omits the unsupported competency rather than treating the reference as sufficient evidence

### Requirement: Distinct cross-team collaboration and leadership signals
The Job Analyzer SHALL persist `crossTeamCollaborationSignals` and `crossTeamLeadershipSignals` as separate categories. Collaboration signals MUST describe work with other teams without implying leadership; leadership signals MUST be emitted only when the source explicitly supports cross-team direction, ownership, or leadership.

#### Scenario: Collaboration is not leadership
- **WHEN** the job source requires partnering or collaborating with other teams but does not assign cross-team leadership
- **THEN** the analysis emits a collaboration signal and emits no cross-team leadership signal for that wording

#### Scenario: Explicit cross-team leadership is retained
- **WHEN** the job source explicitly assigns leadership or ownership across teams
- **THEN** the analysis emits a cross-team leadership signal with its source reference

### Requirement: Canonical domain signals preserve source wording
The Job Analyzer SHALL represent every new domain signal with a canonical value and its source value. It MUST deterministically normalize configured equivalent domain variations to the same canonical value while preserving the original source wording and available source reference.

#### Scenario: Equivalent domain variations normalize identically
- **WHEN** analyses contain configured equivalent domain terms with different casing, plurality, or aliases
- **THEN** their domain signals have the same canonical value and retain their respective source values

#### Scenario: Unknown domain wording is preserved conservatively
- **WHEN** a domain term is not present in the configured equivalence map
- **THEN** the system preserves the source value and uses its deterministic normalized textual form without inventing a different domain classification

### Requirement: Source-aware seniority signals
The Job Analyzer SHALL represent each new seniority signal with a canonical level, source value, signal type, and source reference. It MUST emit a seniority signal only when the source explicitly identifies seniority and MUST NOT infer a canonical level solely from responsibility breadth, collaboration, years of experience, or an ambiguous title.

#### Scenario: Explicit seniority retains provenance
- **WHEN** a job source explicitly states a recognized seniority designation
- **THEN** the analysis records its canonical level, original source value, signal type, and source reference

#### Scenario: No explicit seniority produces no seniority signal
- **WHEN** a job source has no explicit seniority designation
- **THEN** the analysis returns an empty seniority signal collection and does not invent a level

### Requirement: Versioned analysis compatibility and idempotency
The system SHALL keep persisted analyses immutable and readable across analysis-contract versions. It MUST adapt legacy persisted analysis content to the current read model without inventing unavailable source distinctions. For new analyses, the system MUST derive a deterministic analysis identity from the canonical job content hash, analyzer prompt/contract version, provider identifier, and resolved model.

#### Scenario: Existing persisted analysis remains readable
- **WHEN** a persisted legacy analysis is loaded after the refined contract is deployed
- **THEN** the system exposes compatible domain and seniority representations while preserving legacy source values and leaving unrecoverable collaboration data absent

#### Scenario: Repeated equivalent analysis is reused
- **WHEN** a job is analyzed again with unchanged canonical content, prompt/contract version, provider, and resolved model
- **THEN** the system returns the existing matching successful snapshot without calling the provider or persisting a duplicate snapshot

#### Scenario: Changed analysis identity creates a new snapshot
- **WHEN** the canonical content hash, prompt/contract version, provider, or resolved model differs from a prior successful analysis
- **THEN** the system performs a new analysis and persists a distinct immutable snapshot

### Requirement: Conservative analysis enrichment for retrieval
The system SHALL use a compatible latest analysis only as source-aware semantic enrichment for job retrieval. It MUST include canonicalized analysis values without changing deterministic requirements or PKQL filters, identify analysis provenance, and omit unsupported or absent signal categories from retrieval text.

#### Scenario: Normalized analysis enriches semantic text
- **WHEN** a valid current analysis has normalized domain, collaboration, leadership, or explicit seniority signals
- **THEN** the retrieval intent includes their bounded semantic text and analysis provenance while preserving deterministic filters

#### Scenario: Missing seniority does not enrich retrieval
- **WHEN** the selected analysis has no explicit seniority signal
- **THEN** the retrieval intent adds no inferred seniority term

