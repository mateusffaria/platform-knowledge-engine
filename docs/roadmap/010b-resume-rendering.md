# AEM-010B — Resume Rendering and End-to-End Generation

## Goal

Close the professional-knowledge pipeline by deterministically transforming a compatible persisted Resume Content Plan and trusted candidate metadata into an application-ready resume artifact.

## Architecture

```text
Resume Content Plan + exact Curated Evidence Pack + trusted candidate metadata
→ validated ResumeDocument
→ ats-clean-v1
→ Markdown / standalone HTML / selectable-text PDF
→ immutable artifact metadata + provenance manifest
```

AEM-010 remains the LLM-backed content-planning boundary. AEM-010B is deterministic: it has no LLM, retrieval, search, embedding, or factual-enrichment dependency. Browser and PDF libraries remain behind application ports in infrastructure.

## Delivered scope

- canonical, versioned ATS-oriented `ResumeDocument`;
- fixed bilingual `ats-clean-v1` semantic template and single-column A4 CSS;
- deterministic Markdown and standalone HTML rendering;
- lazy Playwright HTML-to-PDF conversion and PDF.js page/text inspection;
- compatible-plan, exact-pack, and trusted candidate-metadata readers;
- canonical logical rendering identity, checksum-valid reuse, custom materialization, and force-aware immutable generations;
- atomic local artifact/manifest storage and immutable Drizzle metadata;
- machine-readable evidence, candidate provenance, coverage, gap, and validation manifest;
- `pke documents resume generate <job-id>` with human/JSON output and progress;
- privacy-safe fail-open observability and persisted Markdown/HTML/PDF end-to-end verification.

## Acceptance criteria

- One compatible persisted plan produces Markdown, HTML, and selectable-text PDF from equivalent `ResumeDocument` content.
- User-facing bodies contain only planned content, trusted candidate metadata, and template-owned labels/formatting; internal evidence IDs remain manifest-only.
- Repeated identical requests reuse checksum-valid artifacts, while `--force` creates an immutable successor with the same logical identity.
- Artifact metadata traces to job description, analysis, Curated Evidence Pack, Resume Content Plan, requirement/component coverage, and known gaps.
- Renderability is reported separately from evidence-based alignment and never presented as a universal ATS score.
- Existing ingestion, claims, retrieval, jobs, reasoning, evaluation, and planning regressions continue to pass.

## Remaining exclusions

DOCX, multiple visual templates, exact source-resume reproduction, visual/template editors, cloud storage, planning-on-missing, cover letters, LinkedIn/interview output, ATS scoring, automated applications, and factual enrichment remain out of scope.

## Next milestone

AEM-011 — Intelligence Benchmarking.
