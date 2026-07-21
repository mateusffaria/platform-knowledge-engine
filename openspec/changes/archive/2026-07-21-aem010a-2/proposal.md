## Why

Compound job requirements are currently evaluated as a single unit, so evidence for one independently testable technology can be obscured by missing evidence for another. Atomic, source-grounded components are needed now to make retrieval, evidence coverage, diagnostics, and resume planning accurately explain what is covered without overstating the original parent requirement.

## What Changes

- Introduce atomic requirement components beneath persisted parent `JobRequirement` records, with stable component identifiers, source provenance, original-text traceability, and compatibility adapters for legacy requirements that have no stored components.
- Decompose only coordinated, independently testable requirements supported by the source text, while retaining non-compound conceptual phrases as a single component and prohibiting invented components.
- Generate retrieval intents and candidate-evidence associations per atomic component while retaining the parent requirement identity.
- Represent component-level candidates, diagnostics, selected evidence, rejected evidence, limitations, and qualitative coverage in Candidate and Curated Evidence Packs.
- Derive parent coverage deterministically from finalized component coverage: uniformly covered components retain their bounded shared outcome, mixed covered and missing components produce `partial`, and entirely missing components produce `missing`.
- Allow resume planning to target covered components and preserve missing components without claiming the compound parent is fully covered.
- Deduplicate warnings deterministically by code and message, and report parent requirement counts, atomic component counts, and selected-evidence counts per component.
- Add compatibility and end-to-end tests for compound technology pairs, ordinary conceptual requirements, mixed coverage, stable aggregation, warning deduplication, and legacy persisted runs.

## Capabilities

### New Capabilities
- `atomic-job-requirements`: Defines source-grounded decomposition, component identity and provenance, deterministic parent-coverage aggregation, and legacy compatibility semantics.

### Modified Capabilities
- `job-description-ingestion`: Persists and retrieves atomic components beneath canonical parent requirements without changing original requirement text or provenance.
- `job-retrieval-intents`: Builds stable component-scoped retrieval intents and retains both component and parent requirement identities.
- `candidate-evidence-pipeline-diagnostics`: Associates and diagnoses candidate evidence per component and exposes parent/component cardinality diagnostics.
- `candidate-evidence-pack-output-and-pruning`: Groups lossless candidates and deterministic reasoner selection by component while deduplicating warnings.
- `evidence-reasoning`: Evaluates component coverage independently, derives parent coverage deterministically, and emits component-traceable Curated Evidence Packs.
- `resume-content-planning`: Consumes component coverage so covered components can be used without representing missing siblings or the parent as fully covered.

## Impact

The change affects jobs-domain models and schemas, job parsing and persistence migrations, retrieval-intent construction, candidate association and selection, evidence-reasoner prompts and validation, Curated Evidence Pack persistence/read compatibility, resume-planner inputs and validation, CLI JSON/verbose diagnostics, observability fields, fixtures, and architecture documentation. Existing persisted job requirements, candidate packs, curated packs, and resume-planning inputs remain readable through deterministic legacy adaptation; no existing parent requirement identifier or source text is replaced.
