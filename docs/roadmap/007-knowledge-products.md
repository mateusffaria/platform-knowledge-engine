# AEM-007 — Knowledge Products

## Goal

Generate professional artifacts from verified evidence.

## Problem

The end user needs outputs such as resumes and cover letters, but these outputs must be grounded in verified professional knowledge.

## Scope

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

## Architectural Decisions

### Documents are outputs, not the source of truth

Generated documents should not become the primary knowledge store.

### Traceability

Generated sections should be traceable back to EvidenceClaims where possible.

### Renderer abstraction

Document rendering should be behind a port so implementation can change.

## Acceptance Criteria

- The system can generate a resume draft.
- The system can generate a cover letter draft.
- Outputs use verified evidence.
- Unsupported claims are blocked or flagged.

## Risks

- Generated documents may sound generic.
- Excessive traceability metadata may complicate rendering.
- PDF generation can introduce formatting issues.

## Next Milestone

AEM-008 — AI Observability.
