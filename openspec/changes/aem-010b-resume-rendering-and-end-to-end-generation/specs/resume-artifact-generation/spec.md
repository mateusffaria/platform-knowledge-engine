## ADDED Requirements

### Requirement: Generation loads the latest compatible Resume Content Plan
The system SHALL generate a resume from the latest persisted `ResumeContentPlan` for the requested job, language, length, and supported plan schema, ordered by creation time with ID as a stable tie-breaker. It MUST load the exact referenced Curated Evidence Pack and trusted candidate presentation metadata without invoking planning, an LLM, semantic retrieval, or external search.

#### Scenario: Multiple compatible plans exist
- **WHEN** generation is requested and multiple plans match the job, language, length, and supported schema
- **THEN** the system uses the plan with the greatest creation time, using its ID as a stable tie-breaker

#### Scenario: No compatible plan exists
- **WHEN** generation is requested without a compatible persisted plan
- **THEN** the command fails before rendering with an actionable error telling the user to run `pke documents resume plan <job-id>` with the requested language and length

#### Scenario: Rendering begins from an existing plan
- **WHEN** a compatible plan exists
- **THEN** generation loads only that plan, its exact upstream provenance, and trusted candidate presentation metadata and performs no LLM or retrieval call

### Requirement: One canonical ResumeDocument drives every format
The system SHALL deterministically construct one ATS-oriented `ResumeDocument` from the selected plan and trusted candidate presentation metadata. The document MUST represent a candidate header, optional professional summary, optional technical skills, required professional experience, optional education, optional certifications, document metadata, and non-visible provenance metadata; renderers MUST NOT add, rewrite, translate, strengthen, or otherwise enrich factual content.

#### Scenario: The same source document is rendered in all formats
- **WHEN** Markdown, HTML, and PDF are requested for otherwise identical normalized inputs
- **THEN** all three formats are projections of the same `ResumeDocument` with the same section content and provenance

#### Scenario: Optional candidate content is absent
- **WHEN** trusted candidate metadata has no education or certifications
- **THEN** the document omits those sections without empty headings or placeholder text

#### Scenario: A renderer would need unsupported content
- **WHEN** a requested field is absent from both the plan and trusted candidate metadata
- **THEN** the renderer omits an optional field or rejects a required field and never invents a value

### Requirement: The ats-clean-v1 template has a fixed ATS-oriented structure
The `ats-clean-v1` template SHALL render Candidate Header, Professional Summary, Technical Skills, Professional Experience, Education, and Certifications in that semantic order. Candidate Header and Professional Experience MUST be present; empty optional sections MUST be omitted; experiences MUST be reverse-chronological with stable tie-breaking, and their achievement bullets MUST preserve the plan's job-relevance order.

#### Scenario: A complete document is ordered
- **WHEN** all supported sections contain content
- **THEN** every format emits the six sections in the template-defined order and experience entries appear newest first

#### Scenario: Experience is rendered
- **WHEN** a planned experience has a role, organization, employment period, optional location or context, and ordered bullets
- **THEN** the rendered entry preserves those fields and bullet order without exposing internal evidence IDs in the resume body

#### Scenario: A required experience field is missing
- **WHEN** an experience lacks its role, organization, or employment period
- **THEN** generation fails with the missing field path and does not write or persist an artifact

### Requirement: Markdown rendering is deterministic and readable
The Markdown renderer SHALL emit plain, source-readable Markdown with conventional localized headings, concise bullets, deterministic whitespace, escaped Markdown control characters, and template-defined section order. It MUST contain no decorative or unsupported content and SHALL be suitable as the source representation of the resume.

#### Scenario: Markdown contains special characters
- **WHEN** trusted input contains Markdown control characters
- **THEN** the renderer escapes them without changing the displayed factual text

#### Scenario: Markdown generation succeeds
- **WHEN** a valid ResumeDocument is rendered as `markdown`
- **THEN** the result is non-empty UTF-8 content with media type `text/markdown; charset=utf-8` and the expected localized sections

### Requirement: HTML rendering is standalone, semantic, and print-ready
The HTML renderer SHALL emit a complete semantic HTML document with a language attribute, embedded `ats-clean-v1` CSS, a single-column linear reading order, system fonts, and print rules. It MUST contain no JavaScript, remote fonts, remote assets, layout tables, text boxes, photos, logos, skill-rating graphics, multi-column blocks, or essential content in page headers or footers.

#### Scenario: Standalone HTML is generated
- **WHEN** a valid ResumeDocument is rendered as `html`
- **THEN** the result has media type `text/html; charset=utf-8`, contains semantic header/main/section markup, embedded local CSS, and no network dependency

#### Scenario: HTML contains reserved characters
- **WHEN** trusted content includes characters meaningful to HTML
- **THEN** text and attribute values are escaped while links remain valid and factual text is unchanged

#### Scenario: HTML is printed
- **WHEN** the standalone HTML is loaded in the supported headless browser
- **THEN** meaningful text order is preserved and the print layout uses the single-column A4 template rules

### Requirement: PDF rendering produces an application-ready text document
The PDF renderer SHALL convert the standalone HTML representation through an infrastructure adapter to an A4 PDF with consistent margins, common system fonts, selectable text, preserved links when supported, and multi-page flow without clipped or overlapping sections. It MUST NOT rasterize the full document, and domain/application code MUST NOT depend directly on a browser or PDF library.

#### Scenario: PDF generation succeeds
- **WHEN** a valid ResumeDocument is rendered as `pdf`
- **THEN** a non-empty `application/pdf` artifact exists with at least one page and meaningful extracted candidate and experience text

#### Scenario: Content spans multiple pages
- **WHEN** a detailed valid ResumeDocument exceeds one page
- **THEN** the PDF contains multiple pages with readable flowing content and no overlapping or clipped sections

#### Scenario: PDF inspection fails
- **WHEN** the produced PDF has no pages, no meaningful extracted text, or lacks expected sections
- **THEN** generation fails validation and does not persist successful artifact metadata

### Requirement: Generation validates input and output without repairing content
Before rendering, the system SHALL validate plan existence and schema compatibility, requested language and length, required candidate metadata, exact pack linkage, evidence reference validity, selected/omitted disjointness, required experience content, and absence of unsupported empty placeholders. After rendering, it SHALL validate non-empty output, expected sections, format structure, and a calculable checksum; validation MUST report typed actionable errors and MUST NOT modify source content.

#### Scenario: Selected and omitted evidence conflict
- **WHEN** the source plan marks an evidence ID as both selected and omitted
- **THEN** generation fails before document construction and writes no artifact

#### Scenario: Evidence reference is invalid
- **WHEN** document content references evidence absent from the exact Curated Evidence Pack selection
- **THEN** generation identifies the content path and offending ID and writes no artifact

#### Scenario: Required candidate metadata is unavailable
- **WHEN** no trusted candidate name can be loaded
- **THEN** generation fails with actionable metadata guidance and does not infer a name from unrelated text

#### Scenario: Output is valid
- **WHEN** format-specific validation succeeds
- **THEN** the system calculates the artifact byte checksum before persisting a successful generation

### Requirement: Logical rendering identity controls immutable reuse
The system SHALL derive a logical rendering identity from canonical normalized plan identity and schema, candidate presentation metadata, format, language, length, template ID/version, and renderer version. Generated timestamps and storage/output paths MUST NOT affect this identity. An existing checksum-valid artifact for the identity SHALL be reused by default; `--force` MUST rerender and persist a new immutable generation under the same logical identity.

#### Scenario: Identical generation is repeated
- **WHEN** a checksum-valid artifact exists for identical logical inputs and `--force` is absent
- **THEN** the system returns or materializes the existing artifact, records a cache hit, and does not invoke a renderer

#### Scenario: Output destination changes
- **WHEN** an identical cached artifact is requested at a different output path
- **THEN** the system atomically materializes the cached bytes at the requested path without changing the logical identity or rerendering

#### Scenario: Force is requested
- **WHEN** `--force` is supplied for an existing logical identity
- **THEN** the system rerenders and persists a new generation record without deleting or mutating earlier records

#### Scenario: Concurrent identical generation races
- **WHEN** concurrent non-forced requests generate the same logical identity
- **THEN** persistence converges on one normal generation identity and both requests return the stored winner

### Requirement: Artifacts and manifests preserve end-to-end traceability
For every successful generation, the system SHALL persist immutable artifact metadata and a machine-readable manifest containing artifact and logical identities, `jobDescriptionId`, `jobAnalysisId` when present, `curatedEvidencePackId`, `resumeContentPlanId`, format, language, length, template and renderer versions, artifact and manifest paths, media type, checksum, generation time, selected and omitted evidence accounting, supporting evidence by content item, candidate-metadata provenance, requirement/component coverage, and known gaps. Internal evidence identifiers MUST remain absent from the user-facing resume body.

#### Scenario: Artifact generation succeeds
- **WHEN** a resume artifact and manifest pass validation and are atomically stored
- **THEN** one immutable metadata record links their paths and checksum to every available upstream identity and provenance set

#### Scenario: Alignment information is reported
- **WHEN** the manifest includes requirement coverage
- **THEN** it separates renderability/parsing checks from job-alignment components and exposes supporting evidence and known gaps without claiming a universal ATS score

#### Scenario: Filesystem commit fails
- **WHEN** either artifact or manifest cannot be committed to storage
- **THEN** no successful database record is persisted and the command reports failure

### Requirement: The documents CLI exposes resume generation
The CLI SHALL provide `pke documents resume generate <job-description-id>` with `--format markdown|html|pdf`, `--language en|pt-BR`, `--length concise|standard|detailed`, `--template ats-clean-v1`, `--output <path>`, `--force`, and `--json`. Format SHALL default to `pdf`, language to `en`, length to `standard`, template to `ats-clean-v1`, and output to an identity-suffixed file under `artifacts/resumes`; invalid enum values MUST fail before service execution, and the command MUST print the selected format, template, source plan, selected evidence count, reuse outcome, and output path on success.

#### Scenario: Default human-readable generation succeeds
- **WHEN** a user generates a resume without `--json`
- **THEN** the CLI prints one concise completion summary including format, template, plan ID, evidence count, reuse outcome, and artifact path

#### Scenario: JSON output is requested
- **WHEN** a user supplies `--json`
- **THEN** stdout contains exactly one machine-readable generation result and interactive progress is suppressed

#### Scenario: An option value is invalid
- **WHEN** a user supplies an unsupported format, language, length, or template
- **THEN** the CLI exits non-zero before loading a plan or writing an artifact

### Requirement: Resume generation is observable and privacy-safe
The system SHALL instrument `documents.resume.generate` with stages for plan loading, validation, document construction, format rendering, artifact validation, persistence, output writing, and reuse. It SHALL emit bounded generation/rendering duration, output size, page count, evidence count, section count, failure, validation-failure, and cache-hit measurements plus structured identity/version/path/outcome fields. Observability failures MUST NOT change generation results, and professional content or contact data MUST NOT be captured unless explicit content capture is enabled.

#### Scenario: PDF generation is observed
- **WHEN** PDF generation succeeds with metadata-only telemetry
- **THEN** spans, metrics, and logs record safe IDs, versions, format, counts, sizes, timing, path, and outcome without rendered or professional content

#### Scenario: A cached artifact is reused
- **WHEN** generation returns an existing artifact
- **THEN** telemetry records an artifact reuse event and cache hit with no render span

#### Scenario: An exporter fails
- **WHEN** a trace, metric, log, or external observability export fails
- **THEN** generation returns the same artifact or application error it would have returned with no-op observability

### Requirement: Automated verification and documentation cover the complete MVP
The project SHALL provide deterministic unit tests for document construction, ordering, optional sections, escaping, identity, naming, validation, renderer selection, and reuse; integration tests for every format, PDF pagination/text extraction, CLI output, persistence, force, and invalid inputs; and at least one end-to-end fixture from persisted Curated Evidence Pack and Resume Content Plan through Markdown, HTML, and PDF. Documentation SHALL explain the complete flow, prerequisites, commands, output storage, architecture boundaries, template versioning, traceability, determinism, and current limitations.

#### Scenario: End-to-end fixture runs
- **WHEN** the resume-artifact end-to-end fixture executes
- **THEN** the same persisted plan produces valid Markdown, standalone HTML, and a selectable-text PDF without any LLM or retrieval invocation

#### Scenario: Existing behavior is verified
- **WHEN** the full test suite runs after generation support is added
- **THEN** existing ingestion, retrieval, reasoning, evaluation, and planning tests continue to pass

#### Scenario: A developer follows the documentation
- **WHEN** a developer has applied migrations and has a compatible Resume Content Plan
- **THEN** the documented generation command produces an artifact and explains where its manifest and traceability metadata are stored
