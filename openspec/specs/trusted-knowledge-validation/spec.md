# Trusted Knowledge Validation Specification

## Purpose
Defines the required behavior for the `trusted-knowledge-validation` capability.

## Requirements

### Requirement: Claim trust status is persisted
The system SHALL persist validation status and assessment metadata for every `EvidenceClaim`.

#### Scenario: New claim receives trust metadata
- **WHEN** a new evidence claim is persisted during ingestion
- **THEN** the claim has a status, confidence score, conflict severity, reviewed timestamp when applicable, and review reason when applicable

#### Scenario: Existing claims are migrated safely
- **WHEN** existing evidence claims are migrated to the trusted-knowledge model
- **THEN** the claims are retained with auditable identifiers and a conservative default status that does not mark them as rejected or superseded

#### Scenario: Status transitions are auditable
- **WHEN** a claim status changes
- **THEN** the system records the previous status, new status, timestamp, reason, and transition source without deleting the claim's prior traceability

### Requirement: Deterministic conflict detection classifies evidence
The system SHALL detect conflicts using deterministic rules before claims are used as trusted evidence.

#### Scenario: Missing evidence is not a conflict
- **WHEN** one source includes a claim and another source omits that factual attribute
- **THEN** the system does not mark the claim as conflicting solely because the second source is silent

#### Scenario: Contradictory values require review
- **WHEN** two or more claims assert incompatible values for the same factual attribute
- **THEN** the system marks the affected claims as `needs_review` with conflict severity metadata

#### Scenario: Matching evidence can confirm confidence
- **WHEN** independent claims assert the same factual attribute with compatible values
- **THEN** the system can increase confidence and mark the claim as `confirmed` according to deterministic assessment rules

#### Scenario: User review overrides automated scoring
- **WHEN** a user confirms or rejects a claim
- **THEN** the user-selected status takes precedence over automated confidence scoring until a later explicit review transition occurs

### Requirement: Claim assessment runs after ingestion
The system SHALL assess newly ingested claims and persist their validation outcomes.

#### Scenario: Newly ingested single-source claim is assessed
- **WHEN** ingestion creates a claim that has no corroborating or contradictory evidence
- **THEN** the system marks the claim as `single_source` and preserves the source reference needed to review it

#### Scenario: Newly ingested contradictory claim is routed to review
- **WHEN** ingestion creates a claim that conflicts with an existing claim for the same factual attribute
- **THEN** the system marks the relevant claim set as `needs_review`

#### Scenario: Source reliability affects confidence but not truth
- **WHEN** assessment uses source reliability or priority metadata
- **THEN** that metadata can influence confidence and review ordering but MUST NOT override detected contradictions or explicit user review

### Requirement: Claims can be reviewed from the CLI
The system SHALL provide CLI commands for reviewing, confirming, and rejecting claims.

#### Scenario: Claims needing review are listed
- **WHEN** the user runs `pke claims review`
- **THEN** the command lists claims requiring review with claim id, status, conflict severity, source context, and review reason or conflict summary when available

#### Scenario: Claim is confirmed
- **WHEN** the user runs `pke claims confirm <claim-id>`
- **THEN** the system marks the claim as `confirmed`, records a review transition, and makes the claim eligible for trusted evidence use

#### Scenario: Claim is rejected with a reason
- **WHEN** the user runs `pke claims reject <claim-id> --reason "<reason>"`
- **THEN** the system marks the claim as `rejected`, records the reason, and excludes the claim from trusted evidence use

### Requirement: Claim status controls retrieval and generated-output eligibility
The system SHALL use claim status to decide whether a claim can be indexed, searched, or used as trusted evidence in generated outputs.

#### Scenario: Confirmed claim is eligible
- **WHEN** a claim status is `confirmed`
- **THEN** the claim is eligible for semantic indexing, trusted retrieval, and generated evidence outputs

#### Scenario: Single-source claim is searchable by default
- **WHEN** a claim status is `single_source`
- **THEN** the claim is eligible for semantic search by default with status metadata that identifies it as single-source evidence

#### Scenario: Rejected claim is excluded
- **WHEN** a claim status is `rejected`
- **THEN** the claim MUST NOT be semantically indexed, returned as trusted evidence, or used in generated outputs

#### Scenario: Superseded claim remains auditable but inactive
- **WHEN** a claim status is `superseded`
- **THEN** the claim remains persisted for auditability but MUST NOT be active for semantic indexing, trusted retrieval, or generated outputs

#### Scenario: Eligibility change removes stale embeddings
- **WHEN** a claim changes from an indexable status to a non-indexable status
- **THEN** the system removes or refreshes semantic embeddings so stale claim vectors are not returned

### Requirement: Trusted-knowledge policy is documented
The system SHALL document trusted-knowledge behavior outside the README.

#### Scenario: Detailed policy documentation exists
- **WHEN** the trusted-knowledge change is complete
- **THEN** `docs/trusted-knowledge.md` documents statuses, default search eligibility, review workflow, and the rule that absence of evidence is not contradiction

#### Scenario: ADR records validation policy
- **WHEN** the trusted-knowledge change is complete
- **THEN** `docs/adr/0003-trusted-knowledge-policy.md` records that deterministic rules and user review take precedence over LLM judgment

#### Scenario: README remains concise
- **WHEN** the trusted-knowledge documentation is added
- **THEN** the README links to detailed trusted-knowledge documentation without becoming the detailed policy source

