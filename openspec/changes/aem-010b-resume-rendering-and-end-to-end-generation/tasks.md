## 1. Rendering Foundations

- [x] 1.1 Add and pin Node.js 22-compatible Playwright/Chromium and PDF text-inspection dependencies, with scripts or configuration needed by local development and CI.
- [x] 1.2 Add documents-domain types for resume format, template identity, candidate presentation metadata, canonical `ResumeDocument` sections, provenance, rendered results, manifests, and immutable generated artifacts.
- [x] 1.3 Define version constants and supported-value registries for `ResumeDocument`, renderer, `ats-clean-v1`, plan schemas, formats, languages, and length profiles.
- [x] 1.4 Add documents application ports for compatible plan/source loading, candidate metadata projection, renderer selection, HTML-to-PDF conversion, PDF inspection, artifact repository, artifact storage, and generation observability.
- [x] 1.5 Extend architecture-boundary tests to prove domain/application rendering code cannot import browser, PDF, database, filesystem, LLM, retrieval, or external SDK implementations.

## 2. Compatible Inputs and Trusted Metadata

- [x] 2.1 Extend `ResumeContentPlanRepository` and its Drizzle adapter with latest-compatible lookup by job, language, length, and supported schema using creation time and ID ordering.
- [x] 2.2 Add a documents-owned reader for the exact Curated Evidence Pack referenced by a plan, including job-analysis identity, coverage, evidence accounting, gaps, and source-document provenance.
- [x] 2.3 Implement the trusted candidate metadata reader anchored to selected-evidence source documents, with deterministic profile selection and allowlisted name, contact, link, education, and certification projection.
- [x] 2.4 Preserve source asset/reference provenance for every projected candidate field and omit ineligible or absent optional metadata without heuristic text cleanup.
- [x] 2.5 Add repository and projection tests for stable plan tie-breaking, unsupported plan schemas, exact pack linkage, profile selection, candidate-name precedence, provenance, and missing optional fields.

## 3. ResumeDocument Construction and Validation

- [x] 3.1 Implement pure `ResumeDocument` construction from a frozen plan, exact pack metadata, and trusted candidate snapshot.
- [x] 3.2 Implement fixed localized section labels/order, deterministic date normalization, reverse-chronological experience sorting with stable tie-breaking, and plan-preserving bullet order.
- [x] 3.3 Implement pre-render validation for locale/length/schema compatibility, candidate name, pack linkage, evidence membership/accounting, required experience fields, and empty placeholders.
- [x] 3.4 Implement document validation for required/optional section policy, canonical ordering, provenance retention, and prohibition of visible internal evidence IDs.
- [x] 3.5 Add focused tests for construction, bilingual labels/dates, ordering, optional sections, missing required fields, invalid evidence, and unsupported placeholders.

## 4. Template, Markdown, and HTML Rendering

- [x] 4.1 Implement the versioned `ats-clean-v1` semantic template helpers and shared deterministic formatting/escaping utilities.
- [x] 4.2 Implement the Markdown renderer with localized conventional headings, concise bullets, escaped control characters, normalized whitespace, and declared UTF-8 media type.
- [x] 4.3 Implement the standalone HTML renderer with semantic elements, safe text/attribute/link escaping, language metadata, and no scripts or remote references.
- [x] 4.4 Implement embedded single-column A4 print CSS using system fonts and rules that prevent clipping, overlap, inappropriate section breaks, and non-ATS layout constructs.
- [x] 4.5 Add golden/unit tests proving equivalent document content and ordering across Markdown and HTML, escaping correctness, no unsupported markup/assets, and deterministic repeated output.

## 5. PDF Rendering and Inspection

- [x] 5.1 Implement a lazy Playwright Chromium `HtmlToPdfConverter` adapter using the standalone HTML, A4 format, fixed margins, printable backgrounds, and link-preserving text output.
- [x] 5.2 Implement the PDF inspector adapter for page count and normalized text extraction without exposing its library outside infrastructure.
- [x] 5.3 Implement the PDF renderer composition and post-render checks for non-empty bytes, at least one page, meaningful candidate/experience text, and expected localized headings.
- [x] 5.4 Add PDF integration fixtures for one-page and multi-page resumes, selectable/extractable text, preserved links when supported, and absence of clipped or overlapping sections.
- [x] 5.5 Verify Markdown and HTML commands do not start or require Chromium at runtime.

## 6. Identity, Storage, and Persistence

- [x] 6.1 Implement canonical input serialization, SHA-256 logical rendering identity, force-aware generation identity, byte checksums, and deterministic extension/media-type selection.
- [x] 6.2 Implement sanitized default naming under `artifacts/resumes` and identity-neutral custom output-path resolution with extension validation.
- [x] 6.3 Implement the machine-readable manifest builder with upstream identities, per-content evidence, selected/omitted accounting, candidate provenance, requirement/component coverage, gaps, and separate renderability/alignment fields.
- [x] 6.4 Add the `generated_resume_artifacts` Drizzle schema and additive migration with immutable metadata, manifest JSON, logical-identity index, generation-identity uniqueness, and upstream lookup indexes.
- [x] 6.5 Implement the Drizzle generated-artifact repository with checksum-valid reuse lookup and conflict-safe convergence for concurrent normal generations.
- [x] 6.6 Implement local artifact storage with temporary files, atomic artifact/manifest commits, cached-byte materialization to a new destination, checksum verification, force-aware replacement, and bounded orphan cleanup.
- [x] 6.7 Add identity, naming, migration-schema, repository-race, filesystem-failure, checksum-corruption, cache reuse, custom-output, and force-generation tests.

## 7. Generation Orchestration and Observability

- [x] 7.1 Implement the `GenerateResume` use case with explicit progress stages for loading, reuse lookup, validation, document construction, rendering, inspection, storage, persistence, and output materialization.
- [x] 7.2 Implement renderer selection for Markdown, HTML, and PDF and typed actionable errors for missing plans, incompatible inputs, unsupported selections, invalid outputs, and corrupt cached artifacts.
- [x] 7.3 Ensure successful persistence occurs only after both artifact and manifest are validated and committed, and ensure retries never report partial work as success.
- [x] 7.4 Add no-op, fail-open, and production generation observability adapters with `documents.resume.generate` spans, bounded metrics, safe structured logs, cache events, and metadata-only defaults.
- [x] 7.5 Wire repositories, readers, renderers, storage, PDF adapters, and observability into `createProductionDocumentsServices` with lazy browser startup and orderly shutdown.
- [x] 7.6 Add use-case tests for success in each format, missing/incompatible plans, cache hits without rendering, forced rendering, corrupted cache behavior, storage/persistence failures, and fail-open telemetry.

## 8. CLI Integration

- [x] 8.1 Register `pke documents resume generate <job-description-id>` with validated format, language, length, template, output, force, and JSON options and the documented defaults.
- [x] 8.2 Implement human completion output containing format, template, plan, selected evidence count, reuse outcome, and artifact/manifest paths.
- [x] 8.3 Implement JSON output as exactly one machine-readable generation result with interactive progress disabled.
- [x] 8.4 Add generation progress messages and ensure terminal feedback, cleanup, and telemetry shutdown cannot change the application result.
- [x] 8.5 Add CLI tests for defaults, every explicit option, invalid values before service creation, missing-plan guidance, human output, JSON-only stdout, custom output, reuse, and `--force`.
- [x] 8.6 Add human feedback for long running tasks as we did for `jobs reason` command and `jobs analyze`

## 9. End-to-End and Regression Coverage

- [x] 9.1 Add a persisted end-to-end fixture spanning an existing Curated Evidence Pack and Resume Content Plan through one shared ResumeDocument to Markdown, HTML, PDF, manifest, and artifact metadata.
- [x] 9.2 Assert the end-to-end fixture makes no LLM/provider or retrieval calls and introduces no body content outside the plan and trusted candidate snapshot.
- [x] 9.3 Add validation assertions for machine-readable provenance, requirement/component coverage, known gaps, and the absence of a universal ATS score claim.
- [x] 9.4 Run database-backed generation integration tests against the additive migration, including artifact reuse, force, and source-plan traceability.
- [x] 9.5 Run `npm run typecheck`, the focused documents/PDF suites, and the complete `npm test` regression suite; resolve all failures.

## 10. Documentation and Operational Handoff

- [x] 10.1 Update README with the complete ingestion-to-generation flow, migration and browser prerequisites, planning/generation commands, defaults, formats, examples, output/manifest locations, and MVP limitations.
- [x] 10.2 Update documents module and architecture documentation with `ResumeDocument`, source/renderer/storage ports, infrastructure adapters, template/version boundaries, deterministic identity, provenance, and privacy-safe observability.
- [x] 10.3 Update resume-planning and AEM roadmap documentation to distinguish LLM-backed content planning from deterministic AEM-010B rendering and remove obsolete “future renderer” statements.
- [x] 10.4 Document PDF dependency installation, CI browser caching, artifact recovery/rollback, corrupt-cache remediation with `--force`, and the separation of renderability from job alignment.
- [x] 10.5 Validate the OpenSpec change, verify all documented commands and paths against the implementation, and record final build/test results for handoff.

## Verification Record — 2026-07-21

- `npm run db:migrate` — passed; additive migration `0013_add_generated_resume_artifacts.sql` applied to local Postgres.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- Focused documents/CLI/real-PDF suite — 4 files and 32 tests passed.
- `PKE_DATABASE_INTEGRATION=1 npm test -- --run tests/resume-generation-e2e.test.ts` — 2 persisted Postgres/Chromium end-to-end tests passed.
- `npm test` — 32 files passed, 279 tests passed; the 2 opt-in database tests were skipped in the ordinary run and passed separately above.
- Built CLI help verified the documented planning/generation options, defaults, and paths.
- `git diff --check` — passed.
- Strict OpenSpec validation — 1 change passed with no issues.
