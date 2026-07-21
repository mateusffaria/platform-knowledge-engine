## Context

The jobs module currently turns a canonical job description and its deterministic requirements into a retrieval intent, then delegates hybrid search to retrieval. Retrieval returns a ranked `EvidencePack` of trusted canonical claims with claim identity, scores, and provenance. That ranking is deliberately deterministic and is not an assessment of whether the candidate satisfies a job requirement. The Job Analyzer separately demonstrates the project pattern for a bounded LLM application service: a versioned prompt, `LlmProvider` port, Zod parsing, immutable persisted result, and Langfuse-facing observability port.

This change introduces the next bounded step: curate a preselected, canonical Candidate Evidence Pack against a job's requirements. The reasoner must not retrieve, hydrate, or mutate professional knowledge. It is allowed to compare the supplied candidates, select complementary support, reject unsuitable candidates, and explain coverage limits. The existing candidate-pack producer is responsible for canonical hydration, relationship traversal, eligibility, grouping, and deterministic objective signals before the reasoner is called.

## Goals / Non-Goals

**Goals:**

- Produce a validated, persisted `CuratedEvidencePack` for a job from an immutable Candidate Evidence Pack.
- Assess each deterministic job requirement independently using only its supplied eligible candidate claims and objective signals.
- Preserve canonical claim identities, text, status, provenance, and objective signals without allowing the model to replace them.
- Select complementary evidence while removing redundant selections across requirements through deterministic post-processing.
- Record qualitative coverage, uncertainty, warnings, and limitations; derive any display score deterministically from the qualitative statuses.
- Reuse the provider and observability boundaries already used by job analysis, with a separate evidence-reasoning prompt version and trace lifecycle.

**Non-Goals:**

- Retrieving from PostgreSQL, pgvector, repositories, external search, files, or other unrestricted tools from inside the reasoner.
- Creating, editing, reconciling, or changing the trust status of professional evidence.
- Resume, cover-letter, or interview-answer generation; autonomous loops; multiple reasoning agents; provider benchmarking; or fine-tuning.
- Treating coverage as proof that a candidate meets a hiring requirement or turning a qualitative assessment into a probabilistic truth score.

## Decisions

### Use an explicit Candidate Evidence Pack boundary

Introduce a jobs application/domain contract for `CandidateEvidencePack` with `jobDescriptionId`, selected `jobAnalysisId` when present, pack schema version and deterministic content hash, generation time, requirements, candidate evidence, objective signals, and upstream warnings. Each candidate is a canonical evidence claim with immutable claim text, trust/provenance metadata, and a stable `evidenceClaimId`; asset-only retrieval results are not eligible reasoning candidates because selections and rejections must be traceable to a claim identity. The pack groups the candidates supplied for each requirement and includes the deterministic requirement text and importance.

`ReasonJobEvidence` is the orchestration use case. It loads the job and current analysis through jobs ports, asks the existing candidate-pack builder/application boundary for the preselected pack, invokes the reasoner with that value, validates and finalizes the result, then persists it. The `EvidenceReasoner` itself receives the pack as its only domain input and has no repository, search, database, vector-store, or tool port.

Alternative considered: let `LlmEvidenceReasoner` call hybrid retrieval or repositories. That would blur retrieval and jobs ownership, make the model's input unbounded, and permit invisible evidence changes during a reasoning run.

### Make structured output referential rather than generative

The versioned prompt sends numbered, requirement-scoped candidate IDs with immutable canonical claim content and objective signals. Its Zod schema accepts only requirement IDs and evidence-claim IDs that exist in the supplied pack. It returns qualitative decisions and rationales, never claim text, source excerpts, scores, or trust values. Parsing and a post-parse validator enforce that every selection/rejection belongs to the addressed requirement's candidates, there are no duplicate IDs, coverage is one of `strong`, `partial`, `weak`, or `missing`, and `missing` has no selection.

The application reconstructs the persisted selected/rejected evidence by joining returned IDs to the original pack. Consequently, generated text cannot overwrite canonical claim text, objective signals, source references, or trust metadata. Unknown IDs, malformed JSON, unrecognized enum values, contradictory entries, or a model-selected ineligible candidate fail the run before persistence; the source Candidate Evidence Pack remains unchanged.

Alternative considered: accept a free-form curated pack containing model-copied evidence. That would invite drift in canonical content and makes provenance validation unreliable.

### Keep coverage qualitative and make display scoring deterministic

`RequirementCoverage` records requirement identity/text/importance, `coverageStatus`, selected and rejected evidence, strength factors, limitations, and a bounded explanation. `CuratedEvidencePack` contains an overall qualitative summary, coverage entries, flattened recommended/discarded/missing evidence references, warnings, limitations, and run metadata. Strong requires eligible, directly relevant contextual evidence; an isolated skill-only claim without contextual use cannot produce strong coverage. A requirement with no eligible candidate claims is generated deterministically as `missing` without asking the model to fabricate an assessment.

If a compact numeric UI value is useful, an application-owned mapping converts the finalized statuses and requirement importance into an optional display score. The mapping is versioned/configured in code, deterministic, and documented as a presentation aid, not a confidence, truth, or hiring-fit probability. The model never emits or alters it.

Alternative considered: ask the LLM for a 0–100 score. That would give a false impression of precision and would be difficult to compare reliably between models.

### Separate LLM requirement curation from deterministic cross-requirement deduplication

The LLM evaluates eligible candidates per requirement and can mark candidates complementary within that requirement. The application then runs a deterministic global deduplication policy over the valid selections. An evidence claim can remain selected for multiple requirements only when the returned contribution is materially distinct and both requirements retain at least one direct supporting claim; otherwise it is retained for the higher-priority/directly supported requirement using deterministic importance, directness, and stable-ID tie-breakers. Removed duplicate references become `redundant` rejections for their affected requirement and trigger recomputation of that coverage's limitations and qualitative downgrade when necessary. The persisted pack records the final result, not the raw model draft.

Alternative considered: rely on the model for all global deduplication. That makes final output dependent on generation order and fails to guarantee stable behavior for equivalent validated outputs.

### Persist immutable, reproducible reasoning runs

Add a `curated_evidence_packs` (or equivalently named reasoning-run) table and a jobs-owned repository port. Each row stores its identifier, `jobDescriptionId`, nullable `jobAnalysisId`, candidate-pack version/hash, provider, effective model, prompt version, serialized finalized curated result, and `createdAt`, with indexes for job history and candidate-pack identity lookup. A run identity hashes the job description id, selected analysis id or absence, candidate-pack version/hash, provider, model, and prompt version. Equivalent successful requests reuse the matching immutable result; a changed candidate pack, analysis, model, provider, or prompt produces a new run. Unique-conflict recovery loads the existing matching result.

Alternative considered: persist only provider output. It would not capture deterministic finalization or support reliable audit/replay of the result users actually receive.

### Extend the established provider, observability, and CLI patterns

`LlmEvidenceReasoner` reuses `LlmProvider.resolveIdentity` and JSON generation. It defines its own prompt module, schema, and an `EvidenceReasoningObservability` port/adaptor (or a safely generalized existing job-analysis contract) so traces include safe identifiers, candidate-pack hash/version, prompt version, provider/model, provider completion, validation/finalization outcome, and flushing in `finally`. Trace attributes exclude full professional evidence and generated explanations unless the existing privacy policy explicitly permits them.

`pke jobs reason <job-id>` is a thin adapter: it parses `--model`, `--json`, and `--verbose`, calls `ReasonJobEvidence`, prints the finalized pack, and closes both jobs/retrieval composition resources. Human output summarizes coverage and warnings; verbose output additionally shows run metadata, evidence IDs, provenance, selections, rejections, factors, and limitations. JSON returns the complete curated pack.

Alternative considered: put prompt orchestration or rendering rules in the command handler. That would make the curated contract inaccessible to other use cases and weakens testability.

## Risks / Trade-offs

- [Model overinterprets a canonical claim] → Restrict output to references and bounded rationale fields, require claim IDs to be in the supplied requirement group, prompt for omission, and validate/finalize deterministically.
- [A candidate pack lacks claim-addressable evidence] → Exclude asset-only results from reasoner eligibility and surface an upstream warning rather than inventing a selection.
- [Cross-requirement deduplication loses useful support] → Preserve an explicit complementary-use exception only with direct support for both requirements and record the final contribution and rejection rationale.
- [Model output is malformed or internally inconsistent] → Reject before persistence, trace validation failure, return an actionable error, and leave the input pack and prior runs unchanged.
- [Qualitative coverage is mistaken for hiring proof] → Use explicit limitations in output/CLI/docs and constrain numeric scoring to an optional deterministic display value.
- [Persisted reasoning could expose sensitive career information] → Store only already-authorized canonical inputs/outputs, avoid raw prompt/response tracing by default, and use existing local-first database controls.
- [Expanded observability contracts duplicate analyzer code] → Extract only a minimal generic LLM-run trace abstraction if it does not weaken existing job-analysis type safety; otherwise keep parallel, small contracts over a shared Langfuse client.

## Migration Plan

1. Add additive domain models, candidate/curated pack ports, prompt/schema, and mocked-provider tests without changing retrieval output or existing job analysis behavior.
2. Add the curated-pack persistence table, indexes, migration, repository adapter, and immutable run-identity reuse policy; existing jobs and analyses remain readable with no backfill.
3. Compose the candidate-pack builder, reasoner, provider, repository, and observability adapter in production, then add the `jobs reason` command.
4. Update jobs/retrieval documentation, architecture documentation, roadmap, and an ADR that records the bounded evidence-reasoning decision.
5. Run type checking and the full test suite. Rollback removes the additive command and wiring; persisted curated runs remain auditable and do not alter jobs, analyses, canonical claims, or retrieval packs.

## Open Questions

- None. The initial deterministic display-score mapping will be deliberately simple, documented, and treated as a presentation detail that can be revised under a future prompt/contract version.
