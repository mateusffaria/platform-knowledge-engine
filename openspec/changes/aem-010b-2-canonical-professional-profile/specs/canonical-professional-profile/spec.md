## ADDED Requirements

### Requirement: professional-profile/v1 has a versioned Markdown contract
The system SHALL define `professional-profile/v1` as Markdown with YAML front matter containing the scalar values `schema: professional-profile/v1` and `language: en` or `language: pt-BR`. A document claiming this schema MUST contain a `Candidate` section with a non-empty explicitly labeled `Name` field and SHALL support the optional explicitly labeled fields `Headline`, `Location`, `Email`, `Phone`, `LinkedIn`, `GitHub`, and `Website`.

#### Scenario: Minimal canonical profile is valid
- **WHEN** a Markdown document declares `schema: professional-profile/v1`, declares a supported language, and contains a Candidate section with a non-empty Name
- **THEN** the system accepts it as a canonical professional profile even when every optional Candidate field is absent

#### Scenario: Schema declaration is missing or unsupported
- **WHEN** a document is validated specifically as a canonical professional profile but its schema declaration is absent or differs from `professional-profile/v1`
- **THEN** validation fails with an actionable schema error and the document is not persisted as a valid canonical profile

#### Scenario: Language is unsupported
- **WHEN** a document declares `professional-profile/v1` with a language other than `en` or `pt-BR`
- **THEN** validation fails with an actionable language error

#### Scenario: Candidate name is missing
- **WHEN** a document declares `professional-profile/v1` but its Candidate section has no non-empty explicitly labeled Name
- **THEN** validation fails with an actionable candidate-name error and does not infer a name from a heading, file name, email, or other text

### Requirement: Canonical knowledge sections are parsed deterministically
The `professional-profile/v1` parser SHALL recognize the top-level sections `Candidate`, `Professional Summary`, `Professional Experience`, `Technical Skills`, `Education`, and `Certifications`, preserve their source order and text for audit, and map supported structured fields without an LLM or inferred facts.

#### Scenario: Complete profile is parsed
- **WHEN** a canonical profile contains all six canonical knowledge sections and explicitly labeled nested fields
- **THEN** the parser maps each supported field to its deterministic canonical representation and retains source locators for evidence-bearing content

#### Scenario: Unsupported content is present
- **WHEN** a canonical profile contains an unknown field or section
- **THEN** the parser preserves it in raw source content but does not silently map it to a supported Candidate field or invent canonical facts

### Requirement: Candidate presentation metadata has an allowlisted projection
The system SHALL project `Name`, `Headline`, `Location`, `Email`, `Phone`, `LinkedIn`, `GitHub`, and `Website` from the Candidate section into the canonical professional-profile metadata associated with the ingested source. Projection MUST trim surrounding whitespace, preserve the supplied value without semantic rewriting, omit absent optional fields, and retain profile source provenance.

#### Scenario: Candidate fields are projected
- **WHEN** a valid canonical profile supplies Candidate Name, Email, LinkedIn, and GitHub values
- **THEN** the professional-profile metadata contains those normalized allowlisted fields with provenance to that profile source

#### Scenario: Optional contacts are absent
- **WHEN** a valid canonical profile supplies only Candidate Name
- **THEN** the metadata projection contains the name, omits absent contact keys, and remains usable by resume generation

#### Scenario: Duplicate Candidate field is supplied
- **WHEN** a canonical profile contains the same explicitly labeled Candidate field more than once
- **THEN** validation fails with an actionable duplicate-field error rather than selecting a value by document order

### Requirement: Resume generation composes profile metadata with planned content
Resume generation SHALL load Candidate presentation metadata from a valid canonical professional profile associated with the selected generation source and SHALL load rendered resume body content from the compatible persisted `ResumeContentPlan`. It MUST NOT copy arbitrary profile section text into the resume body, call an LLM, retrieve additional evidence, or treat missing optional Candidate fields as fatal.

#### Scenario: Canonical metadata and plan are available
- **WHEN** generation has a compatible ResumeContentPlan and a canonical profile containing a Candidate Name and optional contacts
- **THEN** the generated document uses the profile for the candidate presentation fields and the plan for its renderable body content

#### Scenario: Optional contact metadata is missing
- **WHEN** a compatible plan has renderable experience and the canonical profile has a Name but no optional contact fields
- **THEN** generation succeeds and omits the absent contact values without placeholders

### Requirement: Missing name and missing experience are distinct generation failures
Resume generation MUST validate the required candidate name independently from the presence of at least one renderable planned experience and SHALL return separate typed, actionable errors for those conditions before writing an artifact.

#### Scenario: Candidate name is unavailable
- **WHEN** generation cannot load a non-empty Name from the canonical profile
- **THEN** it fails with a candidate-name error that tells the user to ingest or correct a `professional-profile/v1` document

#### Scenario: Renderable experience is unavailable
- **WHEN** a canonical candidate name exists but the selected ResumeContentPlan contains no experience with the fields required by the active resume template
- **THEN** generation fails with a distinct renderable-experience error that tells the user to correct or regenerate the content plan

#### Scenario: Both inputs are invalid
- **WHEN** both the canonical candidate name and renderable planned experience are missing
- **THEN** validation reports both conditions with distinct codes and paths rather than collapsing them into one metadata error

### Requirement: Canonical profile ingestion remains Markdown-only for the MVP
The system SHALL require existing resume sources to be manually normalized into `professional-profile/v1` Markdown for canonical profile ingestion and MUST NOT claim support for direct PDF or DOCX profile ingestion in this milestone.

#### Scenario: PDF or DOCX profile is supplied
- **WHEN** a user attempts to ingest a PDF or DOCX as a canonical professional profile
- **THEN** the command rejects the input with guidance to normalize it into the canonical Markdown format

