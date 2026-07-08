## ADDED Requirements

### Requirement: Deterministic embedding text
The system SHALL build deterministic embedding text for each indexable `KnowledgeAsset` and `EvidenceClaim`.

#### Scenario: Same record produces same embedding text
- **WHEN** the embedding text builder receives the same knowledge record more than once
- **THEN** it produces identical text with stable field order, stable whitespace normalization, and the same subject identifiers

#### Scenario: Evidence claim text preserves provenance
- **WHEN** the embedding text builder receives an `EvidenceClaim`
- **THEN** the generated text includes the claim text, claim type, knowledge asset id, evidence claim id, and source reference identity needed to trace the result back to the original evidence

#### Scenario: Knowledge asset text preserves asset context
- **WHEN** the embedding text builder receives a `KnowledgeAsset`
- **THEN** the generated text includes the asset title, summary when present, knowledge asset id, and source document identity needed to trace the result back to the original asset

### Requirement: Semantic index stores vector references
The system SHALL store embeddings in a `knowledge_embeddings` table that references original knowledge records instead of duplicating facts as source truth.

#### Scenario: Evidence claim embedding is persisted
- **WHEN** `pke index` indexes an eligible persisted `EvidenceClaim`
- **THEN** the system stores a vector row with the evidence claim id, subject type, related knowledge asset id, source reference identity, embedding text hash, provider/model metadata, and vector value

#### Scenario: Knowledge asset embedding is persisted
- **WHEN** `pke index` indexes an eligible persisted `KnowledgeAsset`
- **THEN** the system stores a vector row with the knowledge asset id, subject type, source document identity, embedding text hash, provider/model metadata, and vector value

#### Scenario: Rejected or unverified claims are not indexed as confirmed facts
- **WHEN** a claim is not eligible as verified professional knowledge
- **THEN** `pke index` MUST NOT store that claim as a confirmed semantic retrieval vector

### Requirement: Indexing is idempotent
The system SHALL make repeated semantic indexing runs idempotent for unchanged knowledge records.

#### Scenario: Re-running index does not duplicate embeddings
- **WHEN** `pke index` runs twice against the same persisted knowledge and embedding provider/model
- **THEN** the second run does not create duplicate `knowledge_embeddings` rows

#### Scenario: Changed embedding text updates the indexed vector
- **WHEN** an indexable record's deterministic embedding text changes
- **THEN** a subsequent `pke index` run refreshes the stored vector for that subject and provider/model instead of leaving stale search content active

### Requirement: Search returns related evidence
The system SHALL provide semantic search over indexed professional knowledge through `pke search "<query>"`.

#### Scenario: Query returns related evidence
- **WHEN** a user runs `pke search "<query>"` after indexing persisted knowledge
- **THEN** the command returns related indexed results ordered by vector similarity and includes enough subject/source identifiers to inspect the original evidence

#### Scenario: Search uses query embeddings through a port
- **WHEN** the search use case embeds a user query
- **THEN** it uses the configured `EmbeddingProvider` port and searches through the configured `VectorStore` port rather than calling provider SDKs or database adapters directly

#### Scenario: Search does not mutate canonical knowledge
- **WHEN** a user runs `pke search "<query>"`
- **THEN** the command does not insert, update, or delete canonical knowledge assets, evidence claims, or source references

### Requirement: Existing ingestion behavior is preserved
The system SHALL preserve existing Markdown ingestion behavior while adding semantic indexing and search.

#### Scenario: Markdown ingestion still persists canonical knowledge
- **WHEN** the existing Markdown ingestion flow runs
- **THEN** it persists source documents, knowledge assets, source references, evidence claims, and evidence-backed career records with the same user-visible behavior as before semantic retrieval was added

#### Scenario: Retrieval commands are separate from ingestion
- **WHEN** a user runs the existing `pke ingest` command
- **THEN** semantic indexing is not required for ingestion to succeed
