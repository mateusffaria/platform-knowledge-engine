## Context

The documents module currently owns an immutable, validated `ResumeContentPlan` aggregate and a CLI planning use case. The plan contains final evidence-grounded wording and selected/omitted evidence accounting, but the module has no final document model, artifact repository, filesystem output, renderer, or compatible-plan lookup. Candidate presentation data such as a name, contact links, education, and certifications remains canonical knowledge rather than planner-authored content. The current persisted plan points to a Curated Evidence Pack, whose row supplies the job-analysis link needed for end-to-end traceability.

The change crosses the documents domain, application ports and orchestration, Drizzle persistence, local filesystem, CLI, telemetry, documentation, and evaluation fixtures. PDF output also requires a new local browser dependency. The design must preserve the existing hexagonal boundaries, remain local-first, and guarantee that rendering cannot call an LLM, perform retrieval, or invent content.

## Goals / Non-Goals

**Goals:**

- Build one immutable ATS-oriented `ResumeDocument` from a compatible plan, trusted candidate presentation metadata, and upstream provenance.
- Render that document deterministically as readable Markdown, standalone HTML, and selectable-text A4 PDF using `ats-clean-v1`.
- Persist immutable artifact records and machine-readable manifests, reuse identical logical renderings, and make `--force` an explicit new generation.
- Validate renderability and produced artifacts, expose concise CLI and JSON results, and instrument the pipeline without leaking resume content by default.
- Prove the complete persisted-plan-to-PDF path while keeping existing planning behavior intact.

**Non-Goals:**

- Changing evidence selection, resume wording, planning prompts, retrieval ranking, or canonical reconciliation.
- Calling an LLM, querying semantic retrieval, enriching facts, translating content, or silently repairing a plan during generation.
- Multiple visual templates, source-resume reproduction, ATS scoring, DOCX, cover letters, cloud storage, or a web UI.
- Automatically running ingestion, job analysis, evidence reasoning, or planning when a compatible plan is missing.

## Decisions

### 1. Separate source loading, document construction, and rendering

`GenerateResume` will orchestrate documents-owned ports for compatible plan lookup, exact Curated Evidence Pack metadata, trusted candidate presentation metadata, artifact persistence, artifact storage, renderers, PDF inspection, and observability. It freezes a `RenderResumeInput`, validates it, builds a `ResumeDocument` with pure application/domain code, then passes only that document and render configuration to a selected renderer.

`ResumeDocument` will contain a required candidate header and professional-experience collection; optional professional summary, technical skills, education, and certifications; document locale and length; and non-visible provenance. Candidate metadata values will carry source asset/reference IDs and will be allowlisted to name, headline, location, contact fields, links, education, and certifications. Experience wording and achievements come only from the plan. The renderer receives no repository, provider, retrieval, or knowledge port, making the factual boundary structural rather than conventional.

Alternative considered: render the `ResumeContentPlan` directly. Rejected because header, optional canonical sections, normalized ordering, locale labels, and provenance would be reimplemented inconsistently by every format.

### 2. Select one compatible plan deterministically and fail when absent

The plan repository will gain `findLatestCompatible(jobDescriptionId, language, length, supportedSchemaVersions)`, ordered by creation time descending and ID descending as a stable tie-breaker. The generator will load the exact Curated Evidence Pack referenced by the winning plan to validate evidence membership and obtain `jobAnalysisId`, coverage, omissions, and gaps for the manifest. A documents-owned candidate metadata reader will load a deterministic trusted presentation snapshot and its provenance; this is bounded canonical metadata loading, not evidence retrieval.

The metadata reader will anchor the snapshot to source documents referenced by the selected pack evidence, choose the most recently ingested matching professional-profile document with source-document ID as a stable tie-breaker, and project only allowlisted metadata. Candidate name uses an explicit `name` source-metadata field when present, otherwise the professional-profile asset title verbatim; it never strips or guesses title fragments. Contact/link fields come from explicit source metadata, while education and certifications come from evidence-backed assets in the same source document whose claims remain eligible. Missing optional values are omitted, and a missing candidate name is an actionable error.

Compatibility requires the requested job, language, length, and a supported plan schema. Missing plans produce an actionable error naming the exact `documents resume plan` command. The MVP will not implement `--plan-if-missing`.

Alternative considered: invoke planning automatically. Rejected because it hides an LLM call inside a deterministic command and broadens failure, configuration, and observability behavior.

### 3. Make `ats-clean-v1` a versioned semantic template

The template owns localized section labels, fixed section order, date formatting, spacing, and print CSS. It emits Candidate Header, Professional Summary, Technical Skills, Professional Experience, Education, and Certifications in that order, omitting empty optional sections. Experiences are sorted reverse-chronologically with stable source-ID tie-breaking, while achievement bullets retain the plan's job-relevance order. Role, organization, and employment period are mandatory for every experience; location/context remain optional.

The layout is single-column, uses system fonts, contains no layout tables, text boxes, images, rating graphics, remote assets, or essential header/footer content. The template has an explicit ID and version so an editorial or CSS change creates a new rendering identity.

Alternative considered: infer section structure from uploaded resumes. Rejected because source documents are evidence inputs and must not control output structure.

### 4. Use Markdown and HTML as direct renderers and Chromium behind a PDF port

Markdown and HTML renderers will independently traverse the same `ResumeDocument` and use centralized escaping and locale/date helpers. HTML will be a complete document with semantic elements, embedded `ats-clean-v1` CSS, no JavaScript, and no remote references. PDF generation will reuse the HTML representation and call an `HtmlToPdfConverter` infrastructure port implemented with a pinned Playwright Chromium dependency. The adapter will request A4 pages, fixed margins, background printing, and link preservation.

A separate `PdfInspector` port, backed by a local PDF parser such as `pdfjs-dist`, will report page count and extracted text. This keeps both browser and PDF-parser APIs out of domain/application logic and allows later adapter replacement.

Alternative considered: generate PDF primitives directly. Rejected because it duplicates layout rules, makes semantic/text extraction harder to verify, and couples templates to one PDF library.

### 5. Distinguish logical rendering identity from generation identity and byte checksum

`renderingIdentity` is SHA-256 over canonical serialization of the plan ID and schema, normalized candidate presentation snapshot, output format, language, length, template ID/version, and renderer version. Timestamps, requested output paths, and storage paths are excluded. Markdown/HTML logical output is deterministic for those inputs; PDF byte metadata may vary without changing the logical identity.

Normal generation derives `generationIdentity` from `renderingIdentity`, allowing concurrent inserts to converge on one immutable artifact. `--force` adds a fresh regeneration nonce only to `generationIdentity`, rerenders, and saves another immutable generation under the same logical identity. The actual artifact bytes receive their own SHA-256 checksum.

Alternative considered: make the output path part of identity. Rejected because exporting the same artifact elsewhere does not change its content. On reuse, the stored artifact is copied atomically to a different requested destination when necessary; the render step remains a cache hit.

### 6. Store an artifact and a JSON manifest as one committed generation

A new `generated_resume_artifacts` table will store IDs and identities, job/job-analysis/pack/plan IDs, format, language, length, template and renderer versions, canonical artifact and manifest paths, media type, checksum, byte count, PDF page count when applicable, manifest JSON, and creation time. It will index logical identity and uniquely constrain generation identity. Saving will use conflict-safe insert semantics so concurrent normal requests return the stored winner.

The filesystem adapter will write artifact and manifest to temporary files in the target directory, validate them, then rename atomically. Default names will be sanitized and stable enough for humans while uniqueness comes from an identity suffix. A requested destination that already contains different bytes will fail unless `--force` permits replacement. Database metadata is persisted only after both files are committed; failures attempt bounded cleanup and never report success.

The manifest will preserve selected/omitted evidence IDs and reasons, supporting IDs by content item, requirement/component coverage and known gaps, candidate-metadata provenance, and all upstream/rendering identities. Renderability/extraction validation is labeled separately from job alignment. No universal ATS score is produced; any future aggregate alignment value must include components, evidence, and gaps.

### 7. Validate before and after every external rendering boundary

Pre-render validation checks plan/schema compatibility, requested locale/length, candidate name, exact pack linkage, selected/omitted disjointness, evidence-reference membership, required experience fields, absence of empty placeholders, and at least one valid experience. Document validation checks fixed section order and provenance preservation.

Post-render validation requires non-empty output and expected localized headings. HTML additionally rejects remote resources/scripts and verifies a parseable semantic structure. PDF must exist, contain at least one page, expose meaningful extracted text including the candidate and experience headings, and have no rendering failure. Checksums are calculated only after validation. Errors are typed and actionable; no validator edits user content.

### 8. Keep CLI output and telemetry deterministic and privacy-safe

`documents resume generate` validates enum options in Commander before service creation. It defaults to `pdf`, `en`, `standard`, and `ats-clean-v1`; without `--output`, it writes `artifacts/resumes/resume-<job-id>-<language>-<length>-<identity-prefix>.<ext>` and a neighboring `.manifest.json`. Human output reports format, template, plan, selected evidence count, reuse status, and output path. `--json` suppresses interactive progress and prints exactly one result object. Stage callbacks cover plan loading, validation, document building, rendering, artifact validation, persistence, output writing, and reuse.

The use case emits a `documents.resume.generate` trace with child spans matching those stages and bounded metrics for duration, format, output size, page count, evidence/section counts, failures, and cache hits. Structured logs contain IDs, versions, path, timing, and outcome. Content, contact details, evidence text, and rendered bytes are excluded unless the existing explicit content-capture policy allows them; telemetry remains fail-open.

## Risks / Trade-offs

- [Chromium installation increases package and CI size] → Pin the adapter dependency, document browser installation, cache its binary in CI, and keep it lazy so Markdown/HTML generation does not launch a browser.
- [Browser/PDF metadata can prevent byte-for-byte identical forced PDFs] → Define determinism at the normalized logical-content identity, keep timestamps out of the resume body, and record the checksum of each concrete generation.
- [Existing canonical data may lack a trustworthy candidate name or complete experience dates] → Fail with field-specific actionable validation instead of inventing placeholders; optional education, certifications, and contact fields are omitted.
- [Database commit and filesystem commit cannot share one transaction] → Use temporary files, atomic rename, insert only after file validation, and idempotent retry/cleanup around orphan candidates.
- [A cached canonical artifact may have been deleted or corrupted] → Verify existence and checksum before reuse; treat a failed cache verification as a validation failure requiring `--force`, never silently trust stale metadata.
- [HTML can fit differently across Chromium versions or host fonts] → Pin the browser version, use a narrow system-font stack, fixed A4 CSS, and automated single/multi-page regression fixtures.

## Migration Plan

1. Add the generated-artifact table and indexes with an additive Drizzle migration; existing plans remain unchanged.
2. Add document, manifest, identity, validation, ports, and pure Markdown/HTML rendering with unit tests.
3. Add filesystem, Drizzle, Playwright, PDF inspection, observability, and composition adapters.
4. Register the CLI command and add integration/end-to-end fixtures, including multi-page and text-extraction checks.
5. Update README, module/architecture documentation, roadmap language, and local/CI PDF prerequisites.

Rollback unregisters the generation command and removes the new adapter wiring. The additive table and artifact files can remain for recovery; destructive table or file removal is a separate operator action.

## Open Questions

No blocking architecture questions remain. Dependency versions will be pinned during implementation after compatibility checks against Node.js 22 and the repository's CI image.
