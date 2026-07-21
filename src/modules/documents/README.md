# Documents Module

The documents module owns evidence-grounded resume planning and deterministic artifact generation. It is not a professional-knowledge source: plans and rendered bodies stay bounded by selected evidence and trusted candidate presentation metadata.

## Boundary

```text
Curated Evidence Pack
        ↓
ResumePlanningInput (eligible evidence + allowlisted presentation metadata)
        ↓
ResumeContentPlanner
        ↓
strict schema + deterministic grounding validation
        ↓
immutable ResumeContentPlan
        ↓
ResumeDocument (pure deterministic construction)
        ↓
ResumeRenderer port
        ↓
Markdown / standalone HTML / selectable-text PDF
        ↓
immutable artifact metadata + provenance manifest
```

The planner is closed-world. It cannot access repositories, retrieval, pgvector, external search, raw source documents, unrestricted tools, or unrelated canonical knowledge. Generation is a separate deterministic boundary: it loads the latest compatible plan, exact referenced pack, and allowlisted candidate metadata, then constructs one `ResumeDocument`. Renderers receive only that document and cannot call an LLM, retrieve evidence, or change facts.

## Hexagonal ownership

- `domain/` owns `ResumeContentPlan`, `ResumeDocument`, formats, manifests, artifact metadata, and version registries.
- `application/ports/` owns planning/provider contracts plus compatible-plan/source/candidate readers, renderer/PDF, artifact repository/storage, and observability ports.
- `application/services/` owns schema-bound LLM planning; pure application helpers own document construction, validation, canonical identity, and manifest construction.
- `application/use-cases/` owns cache-first planning and generation orchestration, validation-before-persistence, immutable reuse, and force-aware regeneration.
- `infrastructure/` owns Drizzle adapters, local atomic storage, Markdown/HTML renderers, lazy Playwright conversion, PDF.js inspection, LLM composition, OpenTelemetry, and Langfuse adapters.
- `interfaces/cli/` owns option validation, progress, and human/JSON presentation only.

`ats-clean-v1/1` controls fixed localized section order, date formatting, escaping, and single-column A4 CSS. Logical rendering identity excludes output paths and timestamps; the immutable manifest retains upstream IDs, evidence/candidate provenance, coverage and gaps, concrete checksums, and separate renderability/alignment fields. Telemetry is metadata-only by default and fail-open; professional content and contact data are not captured.

See `docs/resume-content-planning.md` for the LLM-backed planning boundary and `docs/resume-artifact-generation.md` for generation architecture, CLI, storage, recovery, PDF prerequisites, and verification.
