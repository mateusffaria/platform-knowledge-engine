## Why

The engine can curate job-specific evidence but cannot yet turn that evidence into a bounded, traceable resume content plan. Adding an evidence-grounded planning stage closes that gap while preserving the system's trust guarantees and keeping content decisions separate from visual rendering.

## What Changes

- Introduce a documents-module resume content planning capability that accepts only the latest compatible Curated Evidence Pack plus canonical presentation metadata.
- Produce a structured, language- and length-aware Resume Content Plan containing a professional summary, experiences, bullets, skill groups, omissions, uncovered requirements, warnings, provenance, and version metadata.
- Add an LLM-backed planner behind a `ResumeContentPlanner` port, reusing the shared `LlmProvider`, prompt versioning, and schema-constrained output.
- Deterministically reject unsupported or altered content, including missing evidence references, fabricated technologies, changed metrics or canonical organization/role data, and falsely covered requirements.
- Persist plans immutably and reuse an existing plan for an identical curated-pack/provider/model/prompt/language/length identity.
- Add `pke documents resume plan <job-id>` with model, language, length, JSON, and verbosity options plus an optional compact terminal preview.
- Instrument planning with OpenTelemetry and Langfuse and add golden evaluation scenarios for grounding, fabrication, metric preservation, localization, and bounded length.
- Update architecture, documents, and roadmap documentation for the new planning stage.

## Capabilities

### New Capabilities

- `resume-content-planning`: Evidence-grounded generation, validation, persistence, retrieval, CLI presentation, evaluation, and observability of Resume Content Plans derived from Curated Evidence Packs.

### Modified Capabilities

None.

## Impact

- Adds domain models, ports, use cases, validators, LLM adapter, persistence adapter, and CLI interfaces under `src/modules/documents/`.
- Extends shared database schema and migrations with immutable, versioned resume plan storage.
- Integrates with the jobs module through a narrow Curated Evidence Pack read boundary and with the existing LLM, OpenTelemetry, and Langfuse infrastructure.
- Adds focused unit, integration, CLI, architecture-boundary, and golden evaluation tests.
- Updates architecture, documents-module, command, configuration, observability, evaluation, and roadmap documentation without changing existing ingestion, retrieval, analysis, or evidence-reasoning workflows.
