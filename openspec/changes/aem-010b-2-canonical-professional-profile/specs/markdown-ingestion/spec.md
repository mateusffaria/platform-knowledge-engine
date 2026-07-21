## ADDED Requirements

### Requirement: Markdown ingestion recognizes canonical professional profiles
The Markdown ingestion pipeline SHALL dispatch documents declaring `schema: professional-profile/v1` to a deterministic schema-aware parser that validates the supported language, canonical section structure, and explicitly labeled Candidate fields before persistence. Markdown documents that do not claim this schema SHALL retain their existing ingestion behavior.

#### Scenario: Canonical schema is declared
- **WHEN** `pke ingest <path>` receives Markdown whose front matter declares `schema: professional-profile/v1`
- **THEN** the pipeline applies the `professional-profile/v1` validation and parsing contract before saving canonical knowledge

#### Scenario: Existing generic Markdown is ingested
- **WHEN** `pke ingest <path>` receives supported Markdown that does not declare `professional-profile/v1`
- **THEN** the existing generic Canonical Career Document conversion remains available without requiring the new profile fields

#### Scenario: Canonical profile is malformed
- **WHEN** Markdown claims `professional-profile/v1` but violates its required front matter or Candidate field contract
- **THEN** ingestion exits non-zero with field-specific validation details and persists none of that source version

### Requirement: Canonical Candidate parsing is independent from evidence extraction
The schema-aware Markdown parser SHALL parse Candidate presentation fields through a dedicated deterministic projection and SHALL continue to extract evidence-bearing professional content through the canonical career conversion boundary.

#### Scenario: Candidate contact fields and experience coexist
- **WHEN** a canonical profile contains Candidate contact fields and Professional Experience content
- **THEN** ingestion projects the contact fields as presentation metadata and separately converts supported experience content into evidence-backed canonical knowledge

#### Scenario: Raw canonical source is persisted
- **WHEN** a valid canonical profile is ingested
- **THEN** its original Markdown and YAML front matter remain available for audit alongside the parsed metadata and career knowledge

