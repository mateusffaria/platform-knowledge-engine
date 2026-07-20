# AEM-010 — Evidence-Grounded Resume Content Planning

## Goal

Create a structured Resume Content Plan exclusively from the latest compatible Curated Evidence Pack.

## Architecture

```text
Curated Evidence Pack → Resume Content Planner → validated immutable Resume Content Plan → future Renderer
```

The planner is closed-world and has no repository, retrieval, pgvector, external-search, raw-document, or unrestricted-tool access. The documents use case supplies only curated selections and canonical presentation metadata required for validation and later rendering.

## Scope

- documents-module hexagonal boundaries and planner/persistence/observability ports;
- schema-bound LLM planning through the existing provider abstraction;
- traceable summary, experiences, bullets, skill groups, omissions, uncovered requirements, and warnings;
- exact metrics, dates, organizations, roles, technologies, evidence strength, and missing-requirement validation;
- `pt-BR` and `en`, with concise/standard/detailed bounds;
- immutable identity and reuse across pack/provider/model/prompt/language/length;
- CLI JSON/compact/verbose output and interactive progress;
- deterministic golden evaluation and safe OpenTelemetry/Langfuse metadata.

## Acceptance Criteria

- `pke documents resume plan <job-id>` produces a validated plan from the latest compatible Curated Evidence Pack.
- Every factual bullet references selected evidence; unsupported evidence and altered metrics fail deterministically.
- English/Portuguese and distinct bounded length profiles are supported.
- Identical requests reuse the immutable stored plan.
- Existing ingestion, claims, retrieval, jobs, and evidence-evaluation workflows remain functional.

## Out of Scope

- PDF, DOCX, HTML, and visual templates;
- cover letters, LinkedIn content, and interview answers;
- ATS/subjective scoring, provider benchmarking, and LLM-as-judge;
- automated applications.

## Next Milestone

AEM-011 — Intelligence Benchmarking.
