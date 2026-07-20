# AEM-007 — Knowledge Products

## Goal

Generate professional artifacts from verified evidence.

## Problem

The end user needs outputs such as resumes and cover letters, but these outputs must be grounded in verified professional knowledge.

## Long-term Scope

- resume generation
- cover letter generation
- LinkedIn summary generation
- interview answer generation
- artifact traceability
- Markdown/HTML/PDF rendering

## Out of Scope

- visual design customization
- SaaS editing interface
- automated job application submission

## Implemented slice: AEM-010

AEM-010 implements JSON Resume Content Planning only. It consumes the latest compatible Curated Evidence Pack through a closed documents boundary, validates every factual field against selected canonical evidence, persists immutable versioned plans, and exposes `pke documents resume plan <job-id>`.

Deferred from AEM-010: PDF, DOCX, HTML and visual rendering; cover letters; LinkedIn and interview content; subjective writing or ATS scoring; provider benchmarking; and automated applications.

## Architectural Decisions

### Documents are outputs, not the source of truth

Generated documents should not become the primary knowledge store.

### Traceability

Generated sections should be traceable back to EvidenceClaims where possible.

### Renderer abstraction

Document rendering should be behind a port so implementation can change.

## Acceptance Criteria

- The system can generate a validated JSON Resume Content Plan from a Curated Evidence Pack.
- Every factual bullet is traceable to selected canonical evidence.
- Unsupported claims and altered metrics are rejected before persistence.
- Rendering and additional professional artifacts remain explicit later milestones.

## Risks

- Generated documents may sound generic.
- Excessive traceability metadata may complicate rendering.
- PDF generation can introduce formatting issues.

## Next Milestone

AEM-008 — AI Observability.
