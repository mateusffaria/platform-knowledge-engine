# Documents Module

The documents module creates immutable, evidence-grounded content decisions for professional documents. Its first capability is Resume Content Planning.

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
future Renderer
```

The planner is closed-world. It cannot access repositories, retrieval, pgvector, external search, raw source documents, unrestricted tools, or unrelated canonical knowledge. Infrastructure may load the latest compatible Curated Evidence Pack and batch-map presentation metadata before freezing the input. Prompt payloads call the available set `eligibleEvidence`; discarded evidence IDs stay validator-side and are never sent to the model. The provider receives an input-specific JSON Schema whose enums keep evidence, requirement, uncovered-requirement, and source UUIDs in separate output fields.

## Hexagonal ownership

- `domain/` owns the Resume Content Plan aggregate and length/language types.
- `application/ports/` owns planner, compatible-pack reader, plan repository, provider, and observability contracts.
- `application/services/` owns schema-bound LLM planning and deterministic identity.
- `application/use-cases/` owns cache-first orchestration, validation-before-persistence, and immutable reuse.
- `infrastructure/` owns Drizzle, LLM-provider composition, OpenTelemetry, and Langfuse adapters.
- `interfaces/cli/` owns terminal parsing and presentation only.

Renderers remain out of this milestone. They will consume an already validated plan and must not generate or strengthen facts.

See `docs/resume-content-planning.md` for the schema, CLI, validation, migration, evaluation, and operating guide.
