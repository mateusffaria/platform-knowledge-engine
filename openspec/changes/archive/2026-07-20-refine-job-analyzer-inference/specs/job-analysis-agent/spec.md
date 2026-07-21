## ADDED Requirements

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
