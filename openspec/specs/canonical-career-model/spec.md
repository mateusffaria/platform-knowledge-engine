# Canonical Career Model Specification

## Purpose
Defines the required behavior for the `canonical-career-model` capability.

## Requirements

### Requirement: Professional knowledge assets
The system SHALL represent professional knowledge using persistent `KnowledgeAsset` entities with domain asset types for `professional_profile`, `organization`, `professional_experience`, `role`, `project`, `initiative`, `product`, `education`, `certification`, and `skill`.

#### Scenario: Ingest rich professional entities
- **WHEN** a supported source contains organizations, roles, projects, products, education, certifications, and skills
- **THEN** the system records those concepts as `KnowledgeAsset` entities using domain asset types rather than document section names

#### Scenario: Preserve existing profile ingestion
- **WHEN** an existing markdown profile is ingested
- **THEN** the system creates a professional profile asset and associated professional assets without requiring embedding-provider configuration

### Requirement: Document sections are provenance
The system MUST NOT model document section labels as canonical professional entity types.

#### Scenario: Preserve source section labels
- **WHEN** a claim is extracted from a source section such as "Experience", "Projects", "Educação", or "Certifications"
- **THEN** the original section label is preserved as provenance on the source reference or claim
- **AND** no canonical asset type is created solely from that section label

### Requirement: Atomic evidence claims
The system SHALL represent evidence as atomic `EvidenceClaim` records that reference a subject knowledge asset and contain one claim category from `fact`, `responsibility`, `achievement`, `metric`, `capability`, or `relationship`.

#### Scenario: Split compound experience evidence
- **WHEN** a source bullet states a role, an achievement, a metric, and a technology relationship
- **THEN** the system records separate atomic claims for each assertion
- **AND** each claim references the relevant subject asset instead of embedding a complete experience object

#### Scenario: Keep readable claim text
- **WHEN** an atomic claim is persisted
- **THEN** the system preserves a human-readable claim text suitable for review, retrieval display, and embedding text generation

### Requirement: Structured predicates
The system SHALL support structured predicates for relationships and outcomes, including `works_at`, `holds_role`, `uses_technology`, `participated_in`, `occurred_during`, `reduced_processing_time`, `reduced_cost`, `improved_reliability`, and `demonstrates`.

#### Scenario: Record related professional assets
- **WHEN** a claim asserts that a person used a technology on a project
- **THEN** the claim uses the `uses_technology` predicate
- **AND** references the project or profile as its subject
- **AND** references the skill or technology asset as its related object when that asset exists

#### Scenario: Record metric outcomes
- **WHEN** a claim asserts a reduction in processing time, reduction in cost, or reliability improvement
- **THEN** the claim uses the corresponding outcome predicate
- **AND** preserves the metric value, unit, or original value text available from the source

### Requirement: Source provenance and multilingual metadata
The system SHALL preserve provenance for every evidence claim, including source document identity, source reference identity, original excerpt, source language, and original section label.

#### Scenario: Ingest multilingual source evidence
- **WHEN** a non-English source document is ingested
- **THEN** each extracted claim retains the source language when known
- **AND** preserves the original excerpt and original section label without translating or normalizing them away

#### Scenario: Cite claim evidence
- **WHEN** a claim is returned through retrieval or review
- **THEN** the result includes enough provenance to trace the claim back to its source document and original excerpt

### Requirement: Compatibility with reconciliation
The system SHALL keep claim reconciliation functional for the richer model by evaluating claim status, confidence, conflict severity, subject asset, claim category, predicate, related object or value, and source provenance.

#### Scenario: Assess enriched claims
- **WHEN** newly ingested atomic claims are assessed for trust
- **THEN** the reconciliation workflow assigns or preserves statuses such as `single_source`, `confirmed`, `needs_review`, `rejected`, and `superseded`
- **AND** records conflict severity without discarding claim structure

#### Scenario: Review enriched claims
- **WHEN** a user lists, confirms, or rejects claims through the existing claim review flow
- **THEN** the workflow remains usable with enriched claims and retains the claim text and provenance needed for review decisions

### Requirement: Compatibility with semantic and hybrid retrieval
The system SHALL keep semantic search and hybrid evidence-pack retrieval compatible with enriched assets and atomic claims.

#### Scenario: Index enriched professional knowledge
- **WHEN** knowledge indexing runs after enriched ingestion
- **THEN** eligible knowledge assets and evidence claims are indexed with deterministic embedding text that includes asset identity, claim identity, claim category, predicate, readable claim text, status, and provenance

#### Scenario: Retrieve trusted atomic evidence
- **WHEN** hybrid retrieval searches for professional evidence
- **THEN** the result can return trusted atomic claims with their subject asset, claim category, predicate, status, score, source reference, and excerpt

### Requirement: Backward-compatible migration
The system SHALL provide a migration path from existing simplified assets, section-shaped records, and legacy claim types to the richer canonical model while preserving existing source documents, claim statuses, provenance, and retrieval eligibility.

#### Scenario: Migrate existing knowledge
- **WHEN** existing stored skills, experiences, projects, achievements, and evidence claims are migrated
- **THEN** the system preserves their source references, original claim text, review status, confidence score, and conflict severity
- **AND** maps them to enriched assets and conservative atomic claims where the source data supports it

#### Scenario: Maintain current tests during rollout
- **WHEN** existing ingestion, reconciliation, semantic retrieval, hybrid retrieval, and CLI workflows run during the migration period
- **THEN** they continue to pass through compatibility projections or updated expectations without losing supported behavior

