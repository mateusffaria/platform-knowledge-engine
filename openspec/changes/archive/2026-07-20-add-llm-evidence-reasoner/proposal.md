## Why

Candidate Evidence Packs already provide canonical, trusted, and deterministically ranked evidence for a job. They do not yet explain whether that evidence collectively addresses each requirement, select complementary support, or make gaps and overstatement risks explicit. A bounded reasoning step is needed so LLM assistance can improve curation without becoming a second retrieval path or a source of new professional facts.

## What Changes

- Add a jobs-owned `EvidenceReasoner` application port and a bounded `LlmEvidenceReasoner` implementation that evaluates only a supplied Candidate Evidence Pack.
- Add immutable, traceable `CuratedEvidencePack` output models: requirement coverage, selected and rejected evidence, qualitative coverage statuses, warnings, limitations, and an optional deterministic display score derived from qualitative coverage.
- Add schema-validated structured LLM output and a versioned, application-owned evidence-reasoning prompt that prohibits new evidence, trust changes, and rewrites of canonical claims or objective signals.
- Add requirement-by-requirement selection followed by deterministic cross-requirement deduplication, while retaining explicit missing evidence and rejection rationale.
- Persist reasoning-run metadata and curated output with the job-description and analysis identities, candidate-pack version or hash, provider, model, prompt version, and creation time.
- Expose `pke jobs reason <job-id>` with `--model`, `--json`, and `--verbose` options, reuse the existing `LlmProvider` and observability contracts, and document the bounded reasoning workflow and ADR decisions.
- Add focused mocked-provider tests for valid curation, invalid output, missing coverage, deduplication, provenance, persistence, and observability behavior.

## Capabilities

### New Capabilities

- `evidence-reasoning`: Bounded, traceable LLM-assisted curation of canonical Candidate Evidence Packs into validated Curated Evidence Packs for job requirements.

### Modified Capabilities

- None.

## Impact

- Affected code: jobs domain and application models, reasoning ports/use cases, LLM and persistence adapters, CLI composition and handlers, Drizzle schema/migrations, observability wiring, and focused tests.
- Affected APIs: new `EvidenceReasoner` port, curated evidence contracts, reasoning-run persistence contract, and `pke jobs reason` command.
- Dependencies: reuses canonical candidate evidence produced by the existing jobs/retrieval workflow, the existing `LlmProvider`, and the existing no-op/Langfuse observability contracts; it adds no database, vector-store, repository, or search access to the reasoner itself.
- Documentation: updates job-reasoning, architecture, and ADR documentation to state that qualitative coverage is a bounded assessment rather than proof of hiring qualification.
