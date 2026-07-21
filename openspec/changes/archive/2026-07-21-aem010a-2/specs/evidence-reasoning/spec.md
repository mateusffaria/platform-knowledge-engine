## MODIFIED Requirements

### Requirement: Evidence reasoning produces a traceable Curated Evidence Pack
The system SHALL produce a `CuratedEvidencePack` containing `jobDescriptionId`, selected `jobAnalysisId` when available, provider, model, prompt version, creation time, candidate-pack version or hash, overall coverage summary, parent requirement coverage with nested atomic component coverage, recommended evidence, discarded evidence, missing component evidence, normalized warnings, and limitations.

#### Scenario: Curated pack records execution provenance
- **WHEN** a reasoning run succeeds
- **THEN** its Curated Evidence Pack includes the effective provider/model, exact prompt version, candidate-pack version or hash, job identifiers, component-aware contract version, and creation time

#### Scenario: Curated pack keeps canonical evidence references
- **WHEN** curated evidence is returned
- **THEN** every selected or discarded item references the canonical evidence-claim identity and addressed component identity from the input Candidate Evidence Pack and does not replace canonical content

### Requirement: Requirement coverage is qualitative and explicit
The system SHALL create one component-coverage entry for every atomic component in the Candidate Evidence Pack and one deterministically derived parent `RequirementCoverage` entry for every parent requirement. Each component entry MUST contain the parent requirement and component identifiers/text/importance, `coverageStatus`, selected evidence IDs, rejected candidate evidence IDs, strength factors, limitations, and an explanation. `coverageStatus` MUST be one of `strong`, `partial`, `weak`, or `missing`; parent status and summary fields MUST be derived after component validation and deduplication.

#### Scenario: Component has eligible supporting evidence
- **WHEN** PostgreSQL has directly relevant, contextual, and trusted candidate evidence
- **THEN** PostgreSQL component coverage records selected evidence, bounded strength factors and limitations, and a qualitative status independent of sibling Go coverage

#### Scenario: Component has no eligible evidence
- **WHEN** a Kubernetes component contains no eligible canonical evidence claims
- **THEN** the system marks that component `missing`, records its missing scope and limitation, and does not ask the model to invent supporting evidence

#### Scenario: Skill-only evidence is not overstated
- **WHEN** the only support for a component is an isolated skill-only claim without contextual use
- **THEN** the system MUST NOT mark component coverage as `strong` solely from that claim

#### Scenario: Parent coverage is finalized from children
- **WHEN** validated component coverage contains covered Docker and missing Kubernetes
- **THEN** deterministic finalization retains both component outcomes and sets parent coverage to `partial`

### Requirement: Cross-requirement selection is deduplicated deterministically
The system SHALL apply deterministic cross-component and cross-requirement deduplication after validated component-by-component reasoning. It MUST prevent redundant selections from appearing across components or requirements unless the same claim makes a distinct, direct, documented contribution to each component. Any changed child status MUST be finalized before deriving parent coverage.

#### Scenario: Redundant cross-component selection is removed
- **WHEN** the same evidence claim is selected redundantly for multiple components without distinct direct contributions
- **THEN** the system keeps it for the deterministically preferred component, records `redundant` for the other coverage, updates the affected component status, and then recalculates its parent

#### Scenario: Distinct complementary use is retained
- **WHEN** one canonical claim directly supports distinct aspects of two components and each use is explicitly explained
- **THEN** the system retains both references and records the separate component contributions without duplicating canonical claim content

## ADDED Requirements

### Requirement: Reasoning is bounded to parser-supplied components
The Evidence Reasoner SHALL evaluate exactly the parent and component identities supplied by the Candidate Evidence Pack. The structured output schema MUST constrain component references to that allowlist and MUST NOT permit the model to create, merge, rename, or omit components.

#### Scenario: Model returns an unknown component
- **WHEN** provider output references a component ID or component text absent from the Candidate Evidence Pack
- **THEN** validation rejects the output and persists no Curated Evidence Pack

#### Scenario: Model omits a component
- **WHEN** provider output has no coverage decision for a supplied atomic component
- **THEN** bounded validation or fallback supplies deterministic missing coverage without inventing evidence, according to the existing recovery policy

### Requirement: Curated warnings are deterministic and deduplicated
Curated Evidence Pack finalization SHALL normalize warnings to code and message, merge upstream and reasoning warnings, deduplicate by the exact code-and-message pair, and sort the result deterministically.

#### Scenario: Candidate and reasoner repeat a warning
- **WHEN** candidate preparation and reasoning emit the same warning code and message
- **THEN** the finalized Curated Evidence Pack contains one warning with that pair

#### Scenario: Legacy warning strings are loaded
- **WHEN** a historical pack contains string warnings
- **THEN** the compatibility reader assigns the stable legacy code and deduplicates equal code-and-message pairs without rewriting stored content
