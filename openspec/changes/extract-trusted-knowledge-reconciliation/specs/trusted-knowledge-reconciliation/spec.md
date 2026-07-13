## ADDED Requirements

### Requirement: Reconciliation module owns claim assessment policy
The system SHALL provide a dedicated reconciliation module that owns claim assessment, conflict detection, review decisions, and trusted-knowledge eligibility policy.

#### Scenario: Reconciliation module exists
- **WHEN** the project source tree is inspected
- **THEN** `src/modules/reconciliation` contains the reconciliation domain, application ports, use cases, infrastructure adapters when needed, and CLI interfaces needed for trusted-knowledge validation

#### Scenario: Assessment policy is not owned by ingestion or knowledge
- **WHEN** newly ingested claims require assessment
- **THEN** ingestion persists normalized source knowledge first and then invokes reconciliation through an application contract

#### Scenario: Review policy is not owned by retrieval
- **WHEN** claim status determines whether a claim is trusted evidence
- **THEN** reconciliation makes the eligibility decision and retrieval only performs indexing, cleanup, and search effects

### Requirement: Knowledge remains the owner of EvidenceClaim identity and provenance
The system SHALL keep `EvidenceClaim`, `KnowledgeAsset`, source reference, and provenance ownership in the knowledge module.

#### Scenario: Reconciliation reads claim snapshots
- **WHEN** reconciliation assesses claims
- **THEN** it reads claim data through an explicit application port that supplies claim identity, source context, normalized values, and provenance needed for assessment

#### Scenario: Reconciliation persists assessments through a contract
- **WHEN** reconciliation assigns or changes claim assessment status
- **THEN** it persists the result through an explicit application contract without importing knowledge repositories or knowledge infrastructure

#### Scenario: EvidenceClaim provenance is preserved
- **WHEN** a claim is confirmed, rejected, superseded, or marked as needing review
- **THEN** the original claim identity, source references, and audit history remain available

### Requirement: Reconciliation domain models claim status and conflicts
The system SHALL expose reconciliation domain concepts for assessment status, conflicts, conflict severity, and reconciliation results.

#### Scenario: Claim assessment is represented explicitly
- **WHEN** reconciliation evaluates a claim or claim group
- **THEN** it produces a `ClaimAssessment` or `ReconciliationResult` that includes claim id, claim status, confidence when available, conflict severity, review reason when applicable, and transition source

#### Scenario: Conflict is represented explicitly
- **WHEN** incompatible claims assert different values for the same normalized factual attribute
- **THEN** reconciliation records a `Conflict` with the affected claims, normalized subject, incompatible values, and `ConflictSeverity`

#### Scenario: Supported statuses are stable
- **WHEN** reconciliation assigns claim status
- **THEN** it uses the statuses `confirmed`, `single_source`, `needs_review`, `rejected`, and `superseded`

### Requirement: Deterministic conflict detection classifies evidence
The system SHALL detect conflicts using deterministic rules before claims are used as trusted evidence.

#### Scenario: Missing evidence is not a conflict
- **WHEN** one source includes a claim and another source omits that factual attribute
- **THEN** reconciliation does not mark the claim as conflicting solely because the second source is silent

#### Scenario: Compatible evidence can corroborate a claim
- **WHEN** independent claims assert the same factual attribute with compatible values
- **THEN** reconciliation can mark the claim as `confirmed` or increase its confidence according to deterministic assessment rules

#### Scenario: Incompatible facts require review
- **WHEN** two or more claims assert incompatible values for the same normalized factual attribute
- **THEN** reconciliation marks the affected claims as `needs_review` with conflict severity metadata

#### Scenario: User review overrides automated assessment
- **WHEN** a user confirms or rejects a claim
- **THEN** reconciliation preserves the user-selected status over automated confidence scoring until a later explicit review transition occurs

### Requirement: Claims can be reviewed from the CLI
The system SHALL provide CLI commands for reviewing, confirming, and rejecting claims through reconciliation use cases.

#### Scenario: Claims needing review are listed
- **WHEN** the user runs `pke claims review`
- **THEN** the command lists claims requiring review with claim id, status, conflict severity, source context, and review reason or conflict summary when available

#### Scenario: Claim is confirmed
- **WHEN** the user runs `pke claims confirm <claim-id>`
- **THEN** reconciliation marks the claim as `confirmed`, records a review transition, and makes the claim eligible for trusted evidence use

#### Scenario: Claim is rejected with a reason
- **WHEN** the user runs `pke claims reject <claim-id> --reason "<reason>"`
- **THEN** reconciliation marks the claim as `rejected`, records the reason, and excludes the claim from trusted evidence use

#### Scenario: CLI depends on reconciliation use cases
- **WHEN** claims CLI handlers are inspected
- **THEN** they call reconciliation use cases rather than knowledge or retrieval use cases directly

### Requirement: Claim status controls retrieval and indexing eligibility
The system SHALL use reconciliation-owned claim status policy to decide whether a claim can be indexed, searched, or used as trusted evidence.

#### Scenario: Confirmed claim is eligible
- **WHEN** a claim status is `confirmed`
- **THEN** the claim is eligible for semantic indexing, trusted retrieval, and generated evidence outputs

#### Scenario: Single-source claim is searchable by default
- **WHEN** a claim status is `single_source`
- **THEN** the claim is eligible for semantic search by default with status metadata that identifies it as single-source evidence

#### Scenario: Review-only and inactive claims are excluded
- **WHEN** a claim status is `needs_review`, `rejected`, or `superseded`
- **THEN** the claim MUST NOT be semantically indexed, returned as trusted evidence, or used in generated outputs

#### Scenario: Eligibility change removes stale embeddings
- **WHEN** a claim changes from an indexable status to a non-indexable status
- **THEN** reconciliation invokes a retrieval-facing contract so stale semantic embeddings are removed or refreshed by retrieval

### Requirement: Reconciliation respects module dependency boundaries
The system SHALL keep reconciliation isolated from other modules' infrastructure and persistence details.

#### Scenario: Reconciliation application has allowed dependencies
- **WHEN** imports under `src/modules/reconciliation/application` are inspected
- **THEN** they depend only on reconciliation domain, reconciliation ports, and shared application-safe utilities

#### Scenario: Reconciliation does not import knowledge infrastructure
- **WHEN** imports under `src/modules/reconciliation` are inspected
- **THEN** no reconciliation file imports knowledge repositories or knowledge infrastructure adapters

#### Scenario: Reconciliation does not import retrieval infrastructure
- **WHEN** imports under `src/modules/reconciliation` are inspected
- **THEN** no reconciliation file imports retrieval vector stores, pgvector adapters, embedding-provider adapters, or retrieval infrastructure details

#### Scenario: Cross-module collaboration is explicit
- **WHEN** reconciliation needs claim persistence or indexing side effects
- **THEN** those interactions happen through application contracts wired in the composition root

### Requirement: Trusted-knowledge policy is documented
The system SHALL document reconciliation ownership and trusted-knowledge behavior outside the README.

#### Scenario: Detailed policy documentation exists
- **WHEN** the reconciliation extraction is complete
- **THEN** `docs/trusted-knowledge.md` documents statuses, default search eligibility, review workflow, absence-versus-contradiction policy, and the reconciliation module's ownership

#### Scenario: Architecture documentation reflects boundaries
- **WHEN** architecture documentation is inspected
- **THEN** it describes ingestion as parsing and normalization, knowledge as claim/provenance ownership, reconciliation as assessment and review ownership, and retrieval as indexing/search ownership

#### Scenario: README remains concise
- **WHEN** trusted-knowledge documentation is updated
- **THEN** the README links to detailed trusted-knowledge documentation without becoming the detailed policy source
