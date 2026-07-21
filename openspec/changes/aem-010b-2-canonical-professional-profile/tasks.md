## 1. Canonical Profile Contract and Validation

- [x] 1.1 Add typed `professional-profile/v1` schema, language, Candidate field, metadata projection, and structured validation-issue models at the ingestion/domain boundary.
- [x] 1.2 Extend front-matter parsing to preserve scalar type and duplicate-key information needed to require the exact schema and `en|pt-BR` language values.
- [x] 1.3 Implement canonical-profile validation for required front matter, fixed canonical sections, exact Candidate labels, duplicate fields, and a non-empty explicit Name without inferred fallbacks.
- [x] 1.4 Add focused validation tests for the minimal profile, both languages, missing/unsupported schema, unsupported language, missing/empty/duplicate Name, duplicate optional fields, and unknown fields or sections.

## 2. Schema-Aware Markdown Parsing

- [x] 2.1 Dispatch declared `professional-profile/v1` Markdown to a dedicated schema-aware parser while preserving the existing generic Markdown path for undeclared sources.
- [x] 2.2 Implement deterministic heading-tree and labeled-field parsing for Candidate, Professional Summary, Professional Experience, Technical Skills, Education, and Certifications with stable source locators.
- [x] 2.3 Build the nested allowlisted Candidate projection with trimmed, otherwise verbatim values and omitted empty optional fields.
- [x] 2.4 Map supported non-Candidate sections into the existing canonical career assets, atomic claims, and source references without LLM calls or inferred facts.
- [x] 2.5 Add parser tests proving raw content preservation, canonical section mapping, unsupported-content preservation, malformed-profile rejection before persistence, and unchanged generic profile ingestion.

## 3. Metadata and Evidence Persistence

- [x] 3.1 Carry the versioned `professionalProfile` projection through `CanonicalCareerDocument` source metadata and associate it with the `professional_profile` asset and source provenance.
- [x] 3.2 Update persistence and read-port types to round-trip the nested profile projection through the existing JSON metadata carrier without adding a database migration.
- [x] 3.3 Add tests proving Candidate presentation values create no evidence claims while experience, skills, education, certifications, and other supported professional facts remain evidence-backed.
- [x] 3.4 Add database-backed tests for atomic profile persistence, rollback behavior, source-version deduplication, and deterministic metadata retrieval without claim traversal.

## 4. Resume Generation Integration

- [x] 4.1 Update the candidate metadata reader to select only valid `professional-profile/v1` sources, read the nested Candidate projection, and return deterministic source and profile-asset provenance.
- [x] 4.2 Remove candidate-name fallback from asset title, filename, raw content, legacy flat metadata, or evidence claims and return actionable canonical-profile guidance when Name is unavailable.
- [x] 4.3 Restrict the canonical profile contribution to Candidate presentation fields and ensure professional summary, skill, experience, and other resume body text remains sourced from the selected ResumeContentPlan.
- [x] 4.4 Update generation input freezing, logical rendering identity, manifests, and document construction to use the canonical Candidate projection while omitting absent optional contact values.
- [x] 4.5 Refactor generation validation to collect distinct `missing_candidate_name` and `missing_renderable_experience` issues with independent field paths and corrective actions before artifact writes.
- [x] 4.6 Add generation tests for canonical profile selection, multiple-profile tie-breaking, optional contact omission, metadata provenance and identity changes, no body-content leakage, each validation error alone, and both errors together.

## 5. CLI, Examples, and Documentation

- [x] 5.1 Update ingest and resume-generation CLI error formatting so canonical schema/field failures, missing candidate name, and missing renderable experience are separately actionable and machine-readable.
- [x] 5.2 Add complete `en` and `pt-BR` `professional-profile/v1` fixtures and use `examples/profiles/canonical-professional-profile-v1.md` as the documented example.
- [x] 5.3 Document the versioned front matter, canonical headings, Candidate fields, metadata-versus-evidence boundary, ingestion and generation flow, and manual normalization workflow.
- [x] 5.4 Document that direct PDF and DOCX profile ingestion, label localization, schema inference, content translation, and arbitrary profile-to-resume copying remain outside the MVP.

## 6. End-to-End Verification

- [x] 6.1 Add an end-to-end fixture that ingests a canonical profile, persists metadata and evidence separately, loads an existing compatible ResumeContentPlan, and generates a resume with the canonical header and planned body.
- [x] 6.2 Assert the end-to-end path tolerates missing optional contacts, creates no Candidate-field claims, performs no generation-time LLM or retrieval calls, and writes no artifact for either required validation failure.
- [x] 6.3 Run focused ingestion, persistence, documents, CLI, and end-to-end tests; then run `npm run typecheck`, `npm test`, and `git diff --check` and resolve failures.
- [x] 6.4 Validate the OpenSpec change strictly and verify the documented examples and commands against the completed implementation.
