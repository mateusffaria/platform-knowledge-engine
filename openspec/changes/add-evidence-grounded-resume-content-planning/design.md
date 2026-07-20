## Context

The jobs module persists immutable Curated Evidence Packs after bounded evidence reasoning. Each pack identifies the job, requirements, selected canonical `EvidenceClaim` records (including provenance and objective signals), discarded evidence, missing requirements, provider/model/prompt provenance, and creation time. The documents module is currently a placeholder, and the CLI has no documents command tree.

This change introduces the first documents use case. It crosses the documents, jobs, shared database, CLI, evaluation, and observability boundaries, but must preserve the modular-monolith dependency rules. The content planner is an untrusted structured transformation: it can organize and rewrite supplied evidence, but it cannot discover facts. Professional data and model content remain local/private by default, and existing workflows must work when document generation or telemetry is not configured.

## Goals / Non-Goals

**Goals:**

- Create an immutable, traceable Resume Content Plan from the latest compatible Curated Evidence Pack for a job.
- Give the LLM only a bounded planning input consisting of the Curated Evidence Pack and canonical presentation metadata for selected evidence.
- Enforce schema, evidence membership, factual preservation, requirement coverage, requested language, and bounded length before persistence.
- Support deterministic reuse for identical pack/provider/model/prompt/language/length inputs.
- Expose JSON-first CLI output, an optional human preview, safe telemetry, and golden evaluation coverage.
- Establish documents-module hexagonal boundaries that a later renderer can consume without coupling rendering to content generation.

**Non-Goals:**

- PDF, DOCX, HTML, or visual-template rendering.
- Cover letters, LinkedIn content, interview answers, or automated applications.
- Editing canonical knowledge, searching for additional evidence, or inferring missing qualifications.
- ATS scoring, subjective prose scoring, LLM-as-judge evaluation, or provider/model benchmarking.

## Decisions

### Model the plan as an immutable documents-domain artifact

Define `ResumeContentPlan`, `PlannedSummary`, `PlannedExperience`, `PlannedBullet`, `PlannedSkillGroup`, and `OmittedEvidence` in the documents domain. The aggregate contains the required job/pack identity, locale and length profile, content sections, selected and omitted evidence IDs, uncovered requirement IDs, warnings, provider/model/prompt provenance, and `createdAt`. Text-bearing children carry supporting evidence IDs; experiences also carry canonical experience/organization/role/date presentation fields, and bullets carry target requirement IDs, a source organization or experience ID, exaggeration risk, and warnings.

The plan is stored as one immutable JSON snapshot plus indexed identity columns. Renderers will later consume this aggregate through a separate port and will not modify its content decisions.

Alternative considered: persist only rendered prose. That would lose typed traceability, omission decisions, validation inputs, and renderer independence.

### Isolate cross-module reads behind documents-owned input ports

Add a documents application port that returns the most recent persisted Curated Evidence Pack for a job which validates against the current supported input shape. Its infrastructure adapter may read the jobs-owned table and map it into a documents planning DTO; documents domain and application code do not import jobs infrastructure or database types. Stable ordering is `createdAt DESC, id DESC`. If no compatible pack exists, the use case fails before provider invocation.

The orchestration use case may use the input repository and plan repository, but `ResumeContentPlanner.plan` receives only a frozen `ResumePlanningInput`: the validated pack, its selected evidence, and the minimal canonical presentation metadata already attached to or batch-resolved for those selected claims. The planner implementation has no database, retrieval, repository, network-search, or tool port. Presentation metadata is allowlisted to identifiers, organization, role, dates, technology names, evidence text, metrics, and provenance needed for validation/rendering.

Alternative considered: allow the planner to query canonical knowledge or retrieval on demand. This would make grounding non-auditable and allow the model context to drift after evidence curation.

### Reuse `LlmProvider` through a documents port-compatible dependency

`LlmResumeContentPlanner` uses the existing `LlmProvider` contract for identity resolution and schema-bound generation. Composition adapts or re-exports that shared contract without making documents depend on jobs implementation details. A versioned system prompt states the closed-world evidence rules; the user payload is deterministic JSON with stable array ordering. The provider receives an input-specific JSON Schema derived from the strict output schema, with enums that constrain evidence, requirement, uncovered-requirement, and source-experience fields to their respective eligible identifier namespaces. Planned-experience summaries, bullets, targetable requirements, and source IDs use an experience-capable subset that excludes evidence whose effective claim type is `skill`; professional summaries and skill groups retain the full eligible namespace.

Provider identity is resolved before lookup. A SHA-256 plan identity covers the Curated Evidence Pack ID, resolved provider, resolved model, resume-planning prompt version, language, and length. The use case returns an existing plan for that identity before calling the provider. A unique database index makes concurrent identical requests converge on the same immutable record; after a uniqueness race, the use case reloads the winner.

Cache-backed generation commands expose `--force`. Normal execution keeps deterministic identity reuse unchanged. Forced execution adds a fresh opaque regeneration ID to the analysis, reasoning, or plan identity, skips the pre-generation reuse lookup, invokes the provider, and persists a distinct immutable snapshot without deleting or overwriting the prior result. `jobs candidates` and `jobs retrieve` have no candidate/result snapshot cache of their own; for those commands `--force` regenerates their job-analysis dependency before rebuilding the retrieval intent. Embedding indexing retains its existing equivalent `--force` behavior.

Alternative considered: key reuse by job and model only. It would incorrectly reuse content after evidence, prompt, language, or length changes.

### Treat model output as a proposal until deterministic validation succeeds

Use two validation layers. First, Zod parses the provider JSON into a strict schema with no unknown fields and verifies structural relationships and enumerations. Second, a pure validator compares the proposed plan with the exact planning input and returns stable issue codes and paths. Persistence occurs only when both layers pass.

The validator enforces:

- every factual summary sentence, experience statement, bullet, and skill group has supporting evidence;
- every referenced or selected evidence ID is selected in the Curated Evidence Pack, and no discarded/rejected evidence is referenced;
- each target requirement exists and is covered by the cited evidence, while uncovered requirements remain uncovered;
- metric tokens/values and canonical organization, role, date, and technology values are copied exactly from allowlisted source metadata;
- skill-only evidence is used only for skills and is not represented as production experience;
- claimed ownership does not exceed the source evidence's exaggeration-risk/relationship semantics;
- selected and omitted ID sets are complete, disjoint, duplicate-free, and account for every recommended evidence item;
- locale is one of `pt-BR` or `en`, text passes deterministic locale checks, and normalized word/bullet counts fit the selected profile.

Length profiles are centralized constants. Initial maximums are 350 words/4 bullets for `concise`, 650 words/8 bullets for `standard`, and 1,000 words/12 bullets for `detailed`. Prompts also define increasing target detail, and rich golden fixtures require detailed output to retain more supported content than concise output. Sparse evidence may legitimately produce less content; omission is preferred to padding.

Schema validation failure returns a sanitized typed error, records diagnostics, and persists nothing. A first schema-valid draft that fails only evidence membership, selection/omission accounting, uncovered-requirement accounting, requirement-to-evidence reference rules, or skill-to-experience type references may trigger one bounded full regeneration. Repair feedback contains the stable code, indexed path, a code-specific resolution, and the offending identifier only when that identifier is already present in an allowlisted evidence, requirement, or source namespace. Discarded, invented, and otherwise unknown identifiers remain validator-side and are never serialized into repair feedback. For `selected_and_omitted`, the repair-specific provider schema also removes the already-used evidence ID from the `omittedEvidence` enum, converting the correction from advisory text into a structured-output constraint. The regenerated draft must pass every deterministic rule unchanged; the application never deletes or rewrites invalid entries locally. Factual preservation, ownership-strength, locale, and length failures are not repaired. A provider transport/truncation retry may still repeat an individual schema-bound generation once.

Alternative considered: persist warnings alongside invalid output. This would let unsupported resume claims escape the trust boundary.

Alternative considered: silently remove invalid omitted or selected IDs. This would hide model contract violations and could break complete evidence accounting, so repair always regenerates the full proposal and validation remains the only acceptance boundary.

### Keep generation separate from terminal presentation and future rendering

Register `pke documents resume plan <job-id>` through a documents composition root. Options map to the use-case command: `--model`, `--language <pt-BR|en>`, `--length <concise|standard|detailed>`, `--json`, `--verbose`, and `--force`. Defaults are `en` and `standard`; provider/model defaults continue to come from existing LLM configuration.

`--json` writes exactly the persisted Resume Content Plan as machine-readable JSON and suppresses progress/preview text on stdout. Default output is a compact plan preview; `--verbose` adds IDs, grounding, omissions, uncovered requirements, warnings, and generation identity without exposing prompts or raw provider responses. Both are views over the same validated aggregate and are not renderers.

Alternative considered: have the LLM emit terminal Markdown. It would mix content planning with a rendering format and make JSON/persistence validation secondary.

### Add fail-open, content-safe planning observability

Define narrow documents observability ports backed by the existing shared OpenTelemetry and Langfuse infrastructure. Emit a root planning span and child stages for input loading, identity/cache lookup, prompt construction, inference, schema validation, deterministic validation, and persistence. Record bounded duration, token usage when present, validation issue counts, cache outcome, provider/model/prompt version, language, and length. Job, pack, and plan identities belong only in traces/logs, not metric labels.

Langfuse records metadata, timing, usage, and outcome by default. Prompt, evidence, and generated content follow the existing explicit content-capture opt-in. Telemetry failures are caught and cannot change planning, validation, reuse, or CLI results.

Alternative considered: add a second observability stack for documents. Reusing the shared fail-open facade preserves consistent privacy and lifecycle behavior.

### Extend deterministic evaluation with resume-planning fixtures

Add versioned golden scenarios that invoke the planner/validator boundary using immutable Curated Evidence Pack fixtures and controlled provider responses. Assertions cover valid traceability, unknown/discarded evidence, altered metrics, organization/role/date drift, unsupported technologies, skill-to-experience inflation, uncovered-requirement fabrication, output schema, locale, length bounds, and identity reuse. Evaluations do not query or mutate canonical knowledge and do not use an LLM judge.

Alternative considered: judge resume quality only with another LLM. That would not provide deterministic enforcement for the safety invariants in this milestone.

## Risks / Trade-offs

- [Canonical facts can appear in paraphrased forms that exact matching misses] → Normalize only presentation-neutral punctuation/casing, require exact metric/date tokens, keep allowlisted canonical values explicit in the output, and prefer false rejection over unsupported acceptance.
- [Deterministic language heuristics reject valid mixed technical prose] → Exempt allowlisted technologies, organizations, roles, and identifiers; test Portuguese and English fixtures; report a specific locale issue instead of silently accepting the mismatch.
- [A Curated Evidence Pack does not contain enough presentation metadata] → Batch-resolve only selected claim metadata before constructing the frozen planner input; never expose a general repository to the planner.
- [Concurrent identical commands both invoke the provider] → Perform pre-generation lookup and enforce the unique identity at persistence; accept possible duplicate inference but return the stored winner.
- [Large evidence packs exceed provider context] → Supply only curated selections and required coverage/omission context in stable compact JSON, measure payload size, and fail with an actionable bound rather than retrieving or truncating facts implicitly.
- [Strict validation reduces prose flexibility] → Keep validation rules fact-oriented, centralize normalization, and add golden regressions before relaxing any invariant.
- [Telemetry could expose professional data] → Keep content capture off by default and test metadata allowlists and fail-open adapters.

## Migration Plan

1. Add documents domain/application contracts, pure schemas/validators, and unit tests without CLI registration.
2. Add the immutable `resume_content_plans` table and migration with foreign keys, lookup indexes, and unique plan identity; apply it through the normal migration command.
3. Implement Curated Evidence Pack input and plan persistence adapters, LLM planner, composition root, and safe observability wiring.
4. Register the documents CLI and add integration/CLI tests, then add golden evaluation scenarios.
5. Update architecture, documents, CLI/configuration, evaluation, privacy/observability, and roadmap documentation.

Rollback removes CLI registration and application wiring first. The additive table can remain safely unused; a later migration may remove it only after exporting any desired plans. Existing data and workflows require no transformation.

## Open Questions

- Whether canonical presentation metadata should later become a first-class immutable snapshot owned by the jobs pipeline; this change starts with a documents input DTO so that ownership can evolve without changing the planner contract.
- Whether future renderers need an explicit plan schema version in addition to prompt version. The implementation should reserve a schema-version field in persistence metadata even though it is not part of the initial required CLI payload.
