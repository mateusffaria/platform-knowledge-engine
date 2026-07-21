## ADDED Requirements

### Requirement: Canonical profile metadata is persisted atomically
The system SHALL persist the `professional-profile/v1` schema identifier, language, allowlisted Candidate presentation metadata, and source provenance through the existing metadata storage associated with the professional-profile knowledge asset in the same transaction as its source document and derived canonical knowledge. It MUST NOT add presentation-only values to evidence-claim storage.

#### Scenario: Valid canonical profile is saved
- **WHEN** ingestion persists a valid `professional-profile/v1` document
- **THEN** the professional-profile asset can be deterministically resolved to its schema, language, Candidate metadata, and originating source document after the transaction commits

#### Scenario: Persistence fails
- **WHEN** saving the source, professional-profile metadata, or derived canonical knowledge fails
- **THEN** the transaction rolls back and no partial canonical profile version remains available to generation

#### Scenario: Same source version is ingested again
- **WHEN** the same canonical profile path and content hash are ingested more than once
- **THEN** existing source-version deduplication prevents duplicate profile metadata, assets, and evidence claims

### Requirement: Canonical profile metadata can be read without claim traversal
The persistence boundary SHALL allow the documents module to resolve Candidate presentation metadata and its source provenance from a selected canonical professional profile without querying evidence claims for those presentation values.

#### Scenario: Generation loads a candidate header
- **WHEN** resume generation selects a source set containing a valid canonical professional profile
- **THEN** its metadata reader returns the allowlisted Candidate projection and profile provenance without interpreting claim text or using the profile asset title as a fallback name

