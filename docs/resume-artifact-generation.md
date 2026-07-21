# Deterministic Resume Artifact Generation

AEM-010B closes the persisted professional-knowledge pipeline with a local deterministic renderer:

```text
Source Resume → Canonical Knowledge → Job Analysis → Candidate Evidence Pack
→ Curated Evidence Pack → Resume Content Plan → ResumeDocument
→ Markdown / standalone HTML / selectable-text PDF
```

Content planning is LLM-backed and ends at the immutable `ResumeContentPlan`. Generation loads that plan, its exact Curated Evidence Pack, and allowlisted candidate presentation metadata from an ingested `professional-profile/v1` Markdown source. It does not call an LLM, run retrieval, translate, repair, enrich, or introduce facts.

## Prerequisites and commands

Apply migrations and install the pinned Playwright Chromium build before producing PDFs:

```bash
npm install
npm run db:migrate
npm run pdf:install
```

Markdown and HTML generation are lazy and do not launch or require Chromium. Given a job that has completed evidence reasoning, create a plan and generate an artifact:

```bash
npm run pke -- ingest examples/profiles/canonical-professional-profile-v1.md

npm run pke -- documents resume plan <job-id> \
  --language en \
  --length concise

npm run pke -- documents resume generate <job-id> \
  --format pdf \
  --language en \
  --length concise
```

Generation options and defaults are:

```text
--format markdown|html|pdf            default: pdf
--language en|pt-BR                   default: en
--length concise|standard|detailed    default: standard
--template ats-clean-v1               default: ats-clean-v1
--output <path>
--force
--json
--no-progress
```

The requested language and length must have a compatible persisted plan. If none exists, the error prints the exact planning command to run. `--json` emits exactly one generation result on stdout and disables interactive progress.

Generation requires an explicit Candidate `Name` from the canonical profile and never falls back to an asset title, document heading, filename, raw prose, flat legacy metadata, or evidence claim. Optional contact values are simply omitted. A missing name produces `missing_candidate_name`; a plan without a template-valid experience produces `missing_renderable_experience`. These issues have separate paths and corrective guidance and can be returned together.

## ResumeDocument and template boundary

One immutable `ResumeDocument` drives all formats. Its fixed `ats-clean-v1` section order is Candidate Header, Professional Summary, Technical Skills, Professional Experience, Education, and Certifications. Header and experience are required; empty optional sections are omitted. In `resume-content-plan/v2`, summary, skills, and experience body text come only from the plan; canonical profile Education and Certifications remain evidence-bearing knowledge and are not copied directly into the artifact. Experience entries are reverse chronological, bullets retain planner relevance order, and internal evidence IDs never appear in the body.

The template owns localized headings, normalized dates, deterministic whitespace, escaping, and single-column A4 print CSS. Markdown and HTML traverse the same document. PDF delegates the standalone HTML to Playwright through `HtmlToPdfConverter`, then verifies page count and extracted text through `PdfInspector`. Browser and PDF libraries remain infrastructure details behind application ports.

Current version boundaries are explicit: `resume-document/v1`, `ats-clean-v1/1`, `resume-renderer/v1`, `resume-content-plan/v2`, and `resume-artifact-manifest/v1`. Changing document semantics, template content/CSS, or renderer behavior requires the corresponding version change so old artifacts are not incorrectly reused.

## Identity, storage, and traceability

The logical rendering identity is SHA-256 over canonical plan identity/schema, trusted candidate snapshot, format, language, length, template ID/version, and renderer version. Timestamps and output/storage paths are excluded. A checksum-valid artifact with the same identity is reused without rendering. `--force` produces a new immutable generation identity under the same logical identity; it does not mutate or delete earlier records.

Default files are written under `artifacts/resumes/`:

```text
artifacts/resumes/resume-<job-id>-<language>-<length>-<identity-prefix>.<ext>
artifacts/resumes/resume-<job-id>-<language>-<length>-<identity-prefix>.<ext>.manifest.json
```

`--output <path>` must use the selected format's extension. The canonical artifact is still stored immutably, and checksum-verified artifact and manifest bytes are atomically materialized at the requested destination and its neighboring `.manifest.json` path. Existing different bytes are rejected unless `--force` explicitly permits replacement.

`drizzle/0013_add_generated_resume_artifacts.sql` adds immutable metadata, logical/upstream lookup indexes, and unique generation identity. A successful row is inserted only after the artifact and manifest commit. The manifest records upstream job, analysis, pack, and plan identities; format and version boundaries; paths, media type, checksum, byte/page counts; content-level evidence references; selected/omitted evidence; candidate-field provenance; requirement/component coverage; and known gaps.

Renderability is deliberately separate from job alignment. `validation.renderable` and PDF extraction checks mean the artifact can be parsed and inspected; they do not mean the candidate matches the role. `alignment.kind=evidence-coverage` exposes components, supporting evidence, and gaps, and `universalAtsScore` is always `false`.

## Operations, recovery, and rollback

- A missing or checksum-invalid cached artifact fails with guidance to rerun using `--force`. Forced generation creates a valid successor while preserving the corrupt metadata record for audit; investigate or restore the old canonical bytes separately.
- Artifact and manifest writes use temporary files, paired commit/rollback, checksum verification, and bounded cleanup. If a process is killed between filesystem and database commits, an unreferenced file pair may remain. Compare it with `generated_resume_artifacts` before moving it aside; do not delete broad artifact directories.
- If database persistence fails after a write, generation removes the just-written pair best-effort and reports failure. A retry never reports partial work as success.
- Application rollback consists of unregistering/disabling generation and stopping new writes. The additive table and immutable files may remain for recovery. Dropping the table or deleting artifacts is a separate destructive operator decision.

## CI and verification

Cache the Playwright browser directory using a key derived from the operating system, `package-lock.json`, and pinned Playwright version, then install Chromium on a cache miss. A typical Linux job uses:

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npx playwright install --with-deps chromium
npm run typecheck
npm test
```

The normal suite includes real PDF integration tests when Chromium is installed. The real Postgres end-to-end fixture is opt-in so ordinary unit runs do not require a database:

```bash
PKE_DATABASE_INTEGRATION=1 npm test -- --run tests/resume-generation-e2e.test.ts
```

It applies to a migrated database and proves persisted plan/source loading, Markdown/HTML/PDF generation, PDF text extraction, immutable metadata, reuse, force, provenance, coverage/gaps, and the absence of provider or retrieval calls.

## MVP limitations

The MVP supports one ATS-oriented template and Markdown, HTML, and PDF output only. Profile input is canonical Markdown only: direct PDF/DOCX parsing, OCR/conversion, localized schema labels, schema inference, content translation, and arbitrary profile-section copying are unsupported. It also does not support multiple visual templates, source-resume reproduction, a template editor, cloud storage, ATS scoring, cover letters, LinkedIn/interview output, automated applications, factual enrichment, planning-on-missing, or automatic reruns of ingestion/job analysis/evidence reasoning. PDF layout can vary slightly with host fonts even with a pinned browser; logical determinism is defined by normalized inputs, while every concrete byte result has its own checksum.
