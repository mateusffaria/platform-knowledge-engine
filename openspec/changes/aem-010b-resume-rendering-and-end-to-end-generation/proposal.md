## Why

The Professional Knowledge Engine currently stops at a validated `ResumeContentPlan`, so it cannot deliver the application-ready resume that represents the product's end-to-end user value. This milestone closes that gap now with a local-first, deterministic rendering pipeline before further architecture or quality refinements expand the scope.

## What Changes

- Introduce a canonical ATS-oriented `ResumeDocument` built deterministically from a compatible persisted `ResumeContentPlan` and trusted candidate presentation metadata.
- Add renderer ports and infrastructure adapters for Markdown, standalone semantic HTML, and selectable-text A4 PDF output without LLM calls, retrieval, or factual enrichment.
- Add the versioned, single-column `ats-clean-v1` template with fixed localized section names and ordering.
- Add `pke documents resume generate <job-description-id>` with format, language, length, template, output, force, and JSON options; missing compatible plans fail with actionable planning guidance.
- Persist immutable generated-artifact manifests containing provenance, evidence accounting, rendering identity, checksum, storage metadata, and generation time.
- Reuse an existing artifact for identical normalized rendering inputs by default and regenerate only when `--force` is supplied.
- Validate inputs and outputs, instrument generation through the existing observability stack, and add unit, integration, CLI, PDF, and end-to-end coverage.
- Document the now-complete planning-to-artifact workflow, local prerequisites, architecture boundaries, supported formats, storage, and MVP limitations.

## Capabilities

### New Capabilities

- `resume-artifact-generation`: Deterministic ResumeDocument construction, ATS template rendering to Markdown/HTML/PDF, manifest persistence and reuse, CLI generation, validation, traceability, observability, and end-to-end verification.

### Modified Capabilities

- `resume-content-planning`: Update the documented planner-to-renderer contract so a compatible persisted plan is the bounded source for implemented artifact generation rather than rendering remaining excluded from the milestone.

## Impact

- Adds domain and application contracts, use cases, infrastructure renderers, persistence, and CLI composition within the `documents/resume` bounded context.
- Extends the Drizzle schema and migrations for generated resume artifact metadata and provenance manifests.
- Introduces a local HTML-to-PDF dependency behind an adapter and may add a headless-browser runtime prerequisite; no cloud service is introduced.
- Extends filesystem artifact output, shared observability wiring, evaluation fixtures, README guidance, and documents architecture documentation.
- Preserves existing ingestion, knowledge, retrieval, job analysis, evidence reasoning, and content-planning behavior; rendering does not invoke an LLM or retrieve additional evidence.
