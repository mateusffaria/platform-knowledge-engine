# Candidate Evidence Pipeline Diagnostics Specification

## Purpose
Defines the required behavior for the `candidate-evidence-pipeline-diagnostics` capability.

## Requirements

### Requirement: Candidate preparation is requirement-scoped and traceable
The system SHALL prepare Candidate Evidence Pack entries from requirement-scoped retrieval requests. Each request and resulting candidate association MUST retain `requirementId`, `evidenceClaimId` when available, and `knowledgeAssetId` throughout retrieval, hydration, and association.

#### Scenario: Candidate is associated with its source requirement
- **WHEN** a deterministic job requirement produces canonical eligible evidence
- **THEN** the Candidate Evidence Pack associates that evidence with the originating requirement and preserves the requirement, claim, and asset identities

#### Scenario: Weak evidence remains observable
- **WHEN** canonical evidence is eligible but has a weak retrieval score for a requirement
- **THEN** the pipeline retains or explicitly ranks it lower and MUST NOT silently drop it during requirement association

### Requirement: Per-requirement pipeline diagnostics explain all outcomes
The system SHALL attach pipeline diagnostics to every Candidate Evidence Pack requirement. Diagnostics MUST include retrieval intent, raw structured and semantic result counts, eligible result count, canonical hydration count, requirement association count, and ordered discard records with stage, reason, and available retrieval identities.

#### Scenario: Discarded result is traceable
- **WHEN** a raw retrieval result is not associated with a requirement
- **THEN** diagnostics contain its `evidenceClaimId` or `knowledgeAssetId` when available, the stage where it was discarded, and an actionable reason

#### Scenario: No result is silently lost
- **WHEN** raw retrieval results, hydrated claims, and final associations are compared for a requirement
- **THEN** every item is retained, represented by an explicit discard record, or causes an actionable pipeline failure

### Requirement: Semantic retrieval survives an empty structured match
The system SHALL execute semantic retrieval whenever hybrid query planning selects the semantic strategy. An empty structured result set MUST NOT suppress semantic retrieval merely because explicit structured filters were present.

#### Scenario: Semantic candidate survives absent exact predicate
- **WHEN** a requirement contains structured filters that have no exact structured match but semantic search finds a relevant canonical claim
- **THEN** the claim proceeds to canonical hydration and requirement association

### Requirement: Canonical evidence hydration supports both retrieval subjects
The system SHALL use a retrieval-owned `CanonicalEvidenceReader` application port to hydrate canonical evidence after retrieval. It MUST hydrate evidence-claim subjects directly and knowledge-asset subjects through their eligible canonical claims, validating result identity and preserving provenance.

#### Scenario: Evidence-claim result hydrates canonically
- **WHEN** retrieval returns a result with an `evidenceClaimId`
- **THEN** the reader returns the matching canonical claim with consistent knowledge-asset and source identities

#### Scenario: Knowledge-asset result resolves eligible claims
- **WHEN** retrieval returns a knowledge-asset subject without an evidence-claim identity
- **THEN** the reader resolves its eligible canonical claims deterministically or records an explicit no-eligible-claim diagnostic

#### Scenario: Unsupported legacy record is explicit
- **WHEN** a legacy retrieval or canonical claim representation cannot be safely aligned to the current contract
- **THEN** the pipeline records an explicit legacy-compatibility diagnostic and does not silently discard or invent evidence fields

### Requirement: Eligibility uses canonical reconciliation status
The system SHALL determine candidate eligibility from the canonical claim status through the reconciliation application contract. Only `confirmed` and `single_source` claims are eligible; `needs_review`, `rejected`, `superseded`, and missing canonical statuses MUST be excluded with explicit diagnostics.

#### Scenario: Trusted claims are retained
- **WHEN** a hydrated canonical claim has `confirmed` or `single_source` status
- **THEN** it is eligible for association subject only to documented ranking and caller thresholds

#### Scenario: Ineligible claim is diagnosed
- **WHEN** a hydrated canonical claim has an ineligible or unavailable status
- **THEN** it is excluded and diagnostics identify the status and eligibility stage

### Requirement: Candidate score gates are singular and documented
The candidate-evidence pipeline SHALL use the final retrieval ranking score and an explicit caller-provided minimum score as its only score gates. It MUST remove undocumented duplicate structured, semantic, hydration, or association thresholds.

#### Scenario: Low-scoring canonical evidence remains diagnosable
- **WHEN** a canonical candidate is below an explicit minimum final score
- **THEN** diagnostics record the score and threshold as the discard reason

#### Scenario: No implicit threshold is applied
- **WHEN** an eligible canonical candidate has no caller-provided minimum score
- **THEN** it is not discarded solely because of an undocumented intermediate score threshold

### Requirement: Jobs CLI exposes candidate diagnostics
The system SHALL add `pke jobs candidates <job-id>` and SHALL extend `pke jobs retrieve <job-id> --verbose` to expose requirement-scoped candidate pipeline diagnostics. JSON output MUST include complete identity and diagnostic records; concise output MUST summarize retained and discarded counts.

#### Scenario: Candidates command shows prepared input
- **WHEN** a user runs `pke jobs candidates <job-id> --json`
- **THEN** the command returns the Candidate Evidence Pack with candidates and diagnostics for every deterministic requirement before LLM reasoning

#### Scenario: Verbose retrieval shows pipeline stages
- **WHEN** a user runs `pke jobs retrieve <job-id> --verbose`
- **THEN** the command prints requirement intent, result/hydration/association counts, and discarded result identities and reasons

### Requirement: Candidate pipeline is verified end to end
The system SHALL include integration fixtures and end-to-end tests tracing job requirements through intent, retrieval, canonical hydration, eligibility, and Candidate Evidence Pack association.

#### Scenario: Present evidence reaches candidates
- **WHEN** fixtures contain trusted canonical Go, PostgreSQL, AWS, technical-leadership, and Pismo financial-systems evidence for matching job requirements
- **THEN** the corresponding requirement entries contain traceable candidate evidence

#### Scenario: Absent evidence remains explicit
- **WHEN** the fixture has no eligible Kubernetes evidence
- **THEN** the Kubernetes requirement has no associated candidates and diagnostics state that no eligible evidence was found

#### Scenario: Reasoning receives non-empty candidates
- **WHEN** at least one requirement has associated canonical evidence
- **THEN** `pke jobs reason` receives the prepared non-empty Candidate Evidence Pack and does not take the deterministic all-missing shortcut

