# Evidence Reasoning Specification

## Purpose
Defines the required behavior for the `evidence-reasoning` capability.

## Requirements

### Requirement: Evidence reasoning has a bounded candidate-pack input
The system SHALL define an `EvidenceReasoner` application port that accepts only a canonical `CandidateEvidencePack` and returns curated reasoning decisions. The reasoner MUST NOT receive database, repository, vector-store, retrieval, file-system, external-search, or unrestricted tool access.

#### Scenario: Reasoner receives a preselected pack
- **WHEN** job evidence reasoning is requested
- **THEN** the orchestration passes the reasoner a Candidate Evidence Pack containing only the selected canonical requirement groups, eligible canonical evidence claims, objective signals, provenance, and upstream warnings

#### Scenario: Reasoner cannot perform retrieval
- **WHEN** imports and dependencies of the evidence-reasoning application service are inspected
- **THEN** it depends on domain types and explicit reasoning/provider/observability ports and does not depend on database, pgvector, repository, hybrid-search, or external-search infrastructure

### Requirement: Candidate evidence is claim-addressable and preserves canonical provenance
The system SHALL make a candidate eligible for LLM selection or rejection only when it has a canonical `evidenceClaimId`. Candidate evidence presented to the reasoner MUST preserve the canonical claim content, trust status, provenance, and deterministic objective signals without making them model-editable.

#### Scenario: Eligible candidate preserves evidence metadata
- **WHEN** a canonical evidence claim is included in a Candidate Evidence Pack
- **THEN** its stable claim identity, canonical content, trust/provenance metadata, and objective signals are available for bounded evaluation

#### Scenario: Asset-only candidate is not selected
- **WHEN** an upstream retrieval result lacks an evidence-claim identity
- **THEN** it is excluded from reasoner-eligible evidence and the Candidate Evidence Pack or final result records an actionable warning rather than allowing an untraceable selection

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

### Requirement: Selected and rejected evidence decisions are bounded
Every evidence selection SHALL contain `evidenceClaimId`, a selection reason, contribution to the addressed requirement, optional complementary evidence IDs, and `exaggerationRisk` of `low`, `medium`, or `high`. Every evidence rejection SHALL contain `evidenceClaimId` and one reason of `irrelevant`, `weak`, `redundant`, `unsupported_scope`, `lower_quality_alternative`, or `insufficient_provenance`.

#### Scenario: Complementary evidence is selected together
- **WHEN** two candidates directly support different dimensions of the same requirement
- **THEN** the coverage can select both, identifies their complementary relationship, and explains the distinct contribution of each

#### Scenario: Irrelevant candidate is rejected
- **WHEN** a candidate does not directly demonstrate the addressed requirement
- **THEN** the coverage rejects it with `irrelevant` and does not use semantic similarity alone as a selection justification

### Requirement: LLM output is schema-validated and referentially safe
The `LlmEvidenceReasoner` SHALL use the existing `LlmProvider` port with a versioned application-owned prompt and JSON structured-output expectation. The system MUST validate provider output with Zod or an equivalent runtime schema and MUST verify every referenced requirement and evidence-claim identifier against the supplied Candidate Evidence Pack before finalizing a Curated Evidence Pack.

#### Scenario: Valid model response is finalized from canonical input
- **WHEN** the provider returns schema-valid decisions that reference only candidates in their addressed requirement groups
- **THEN** the system reconstructs the final selections, rejections, canonical content, provenance, and objective signals from the input pack rather than from model-generated copies

#### Scenario: Unknown or malformed output fails safely
- **WHEN** the provider returns invalid JSON, an invalid enum, an unknown identifier, a duplicate/contradictory decision, or a selection for a missing requirement
- **THEN** the run fails with an actionable validation error, records a failed observability outcome, persists no curated result, and does not modify the Candidate Evidence Pack

### Requirement: Evidence reasoning is conservative
The evidence-reasoning prompt and validation rules SHALL require selection, rejection, comparison, and explanation only. The reasoner MUST NOT create professional evidence, modify trust status, replace canonical claim content, rewrite deterministic objective signals, or present qualitative coverage as proof that a candidate satisfies a hiring requirement. It MUST prefer omission over unsupported interpretation.

#### Scenario: Candidate limitation remains explicit
- **WHEN** selected evidence lacks organizational scope, measurable impact, ownership, provenance, or another required dimension
- **THEN** the coverage records that limitation and avoids inferring the missing scope from related wording

#### Scenario: Objective signals are preserved
- **WHEN** objective signals are provided with a candidate
- **THEN** the model can use them in its assessment but the finalized Curated Evidence Pack preserves the supplied values unchanged

### Requirement: Cross-requirement selection is deduplicated deterministically
The system SHALL apply deterministic cross-component and cross-requirement deduplication after validated component-by-component reasoning. It MUST prevent redundant selections from appearing across components or requirements unless the same claim makes a distinct, direct, documented contribution to each component. Any changed child status MUST be finalized before deriving parent coverage.

#### Scenario: Redundant cross-component selection is removed
- **WHEN** the same evidence claim is selected redundantly for multiple components without distinct direct contributions
- **THEN** the system keeps it for the deterministically preferred component, records `redundant` for the other coverage, updates the affected component status, and then recalculates its parent

#### Scenario: Distinct complementary use is retained
- **WHEN** one canonical claim directly supports distinct aspects of two components and each use is explicitly explained
- **THEN** the system retains both references and records the separate component contributions without duplicating canonical claim content

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

### Requirement: Display scores are derived deterministically
The system MAY expose an optional numeric coverage display score, but it MUST derive that value deterministically from finalized qualitative coverage statuses and requirement importance. The model MUST NOT generate, alter, or present the value as a truth probability or proof of hiring fitness.

#### Scenario: Equivalent coverage produces the same display score
- **WHEN** two finalized Curated Evidence Packs have the same requirement statuses and importance values
- **THEN** their optional display scores are identical regardless of provider wording or response order

### Requirement: Reasoning runs are immutable and traceable
The system SHALL persist each successful finalized Curated Evidence Pack through a jobs-owned persistence port with `jobDescriptionId`, `jobAnalysisId` when available, candidate-pack version or hash, provider, model, prompt version, serialized finalized content, and `createdAt`. It MUST derive a deterministic run identity from the input and execution identity and reuse an equivalent successful result.

#### Scenario: Equivalent run is reused
- **WHEN** reasoning is requested with the same job description, selected analysis, candidate-pack version/hash, provider, model, and prompt version
- **THEN** the system returns the existing successful Curated Evidence Pack without calling the provider or writing a duplicate run

#### Scenario: Changed candidate pack creates a new run
- **WHEN** the selected analysis, candidate-pack version/hash, provider, model, or prompt version changes
- **THEN** the system performs a new reasoning run and persists a separate immutable result

### Requirement: Reasoning lifecycle is observable
The evidence-reasoning orchestration SHALL trace each provider attempt through the existing observability boundary with safe job identifiers, candidate-pack version/hash, provider/model, prompt version, provider completion/failure, validation/finalization outcome, and a flush on both success and failure. Observability MUST NOT require Langfuse to be enabled for reasoning to function.

#### Scenario: Successful reasoning is traced
- **WHEN** provider output is validated, finalized, and persisted
- **THEN** the trace records provider completion and validation/finalization success before it is flushed

#### Scenario: Validation failure is traced without sensitive raw output
- **WHEN** provider output fails validation
- **THEN** the trace records the validation failure and flushes without persisting the raw invalid output or treating it as a curated result

### Requirement: Jobs CLI exposes curated evidence reasoning
The system SHALL expose `pke jobs reason <job-id>` with `--model`, `--json`, and `--verbose` options. The command MUST be a thin adapter over the reasoning use case and MUST NOT implement retrieval, evidence selection, deduplication, or coverage rules itself.

#### Scenario: Default command prints concise curation
- **WHEN** a user runs `pke jobs reason <job-id>`
- **THEN** the command prints the overall qualitative coverage, requirement statuses, selected evidence summaries, and warnings/limitations

#### Scenario: JSON and verbose output preserve detail
- **WHEN** a user runs the command with `--json` or `--verbose`
- **THEN** JSON prints the complete Curated Evidence Pack and verbose text includes run metadata, canonical evidence identifiers/provenance, selection/rejection reasons, strength factors, and limitations

### Requirement: Evidence reasoning is documented as bounded curation
The system SHALL update jobs, architecture, roadmap, and ADR documentation to describe Candidate Evidence Pack inputs, Curated Evidence Pack outputs, module ownership, LLM boundaries, coverage semantics, persistence/traceability, and the distinction between qualitative coverage and hiring proof.

#### Scenario: Documentation states the non-generative boundary
- **WHEN** evidence-reasoning documentation is inspected
- **THEN** it states that the reasoner evaluates preselected canonical evidence only and cannot retrieve, create professional evidence, alter trust, or prove qualification
