## 1. Documents Domain and Contracts

- [x] 1.1 Replace the documents placeholder with hexagonal folders and add `ResumeContentPlan`, `PlannedSummary`, `PlannedExperience`, `PlannedBullet`, `PlannedSkillGroup`, `OmittedEvidence`, language/length types, and centralized profile bounds.
- [x] 1.2 Define the documents-owned frozen `ResumePlanningInput` and allowlisted canonical presentation metadata DTO without importing jobs infrastructure or database types.
- [x] 1.3 Add application ports for `ResumeContentPlanner`, compatible Curated Evidence Pack loading, immutable Resume Content Plan persistence, LLM generation/identity, and planning observability.
- [x] 1.4 Add strict Zod schemas and JSON Schema output for planner responses and persisted Resume Content Plans, including stable structured diagnostics for malformed or unknown fields.
- [x] 1.5 Add versioned resume-planning prompts and deterministic serialization/stable ordering tests for English, Portuguese, and all length profiles.
- [x] 1.6 Derive an input-specific provider JSON Schema whose enums keep evidence, requirement, uncovered-requirement, and source identifiers in their correct namespaces.
- [x] 1.7 Derive an experience-capable evidence and source namespace that excludes skill-only claims from planned-experience summaries and bullets.

## 2. Deterministic Grounding Validation

- [x] 2.1 Implement pure evidence-membership and selection/omission partition validators that reject unknown, duplicate, discarded, rejected, or unaccounted evidence IDs.
- [x] 2.2 Implement factual preservation validators for exact metrics, dates, organizations, roles, and cited allowlisted technologies, with stable issue codes and content paths.
- [x] 2.3 Implement requirement-coverage validators that preserve uncovered requirements and require each target requirement to be supported by the bullet's selected evidence.
- [x] 2.4 Implement evidence-strength validators that prevent weak/contributory evidence from becoming strong ownership and skill-only evidence from becoming production experience or achievements.
- [x] 2.5 Implement deterministic `pt-BR`/`en` locale validation with canonical-term exemptions and normalized 350/650/1,000-word plus 4/8/12-bullet profile bounds.
- [x] 2.6 Add focused validator tests for valid plans and every unsupported-fact, grounding, coverage, locale, length, and accounting rejection path, proving invalid plans cannot reach persistence.
- [x] 2.7 Report evidence membership failures with indexed paths and offending IDs in actionable content-safe diagnostics.
- [x] 2.8 Report exact indexed requirement-reference paths and allow one bounded repair for requirement/accounting diagnostics while preserving full validation.
- [x] 2.9 Include allowlist-filtered offending identifiers and code-specific resolutions in repair feedback without echoing discarded or invented IDs.
- [x] 2.10 Treat skill-to-experience reference promotion as a bounded repairable relationship while preserving full regenerated-draft validation.

## 3. Planner and Planning Use Case

- [x] 3.1 Implement `LlmResumeContentPlanner` with the existing LLM provider contract, strict structured response format, resolved identity, safe bounded transport/truncation retry, and no repository/tool dependencies.
- [x] 3.2 Implement deterministic plan identity hashing over Curated Evidence Pack ID, resolved provider/model, prompt version, language, and length.
- [x] 3.3 Implement the planning orchestration use case to load the latest compatible pack, build/freeze the closed-world input, reuse an existing plan before inference, validate generated output, and persist only a valid immutable aggregate.
- [x] 3.4 Handle concurrent identity conflicts by reloading and returning the stored winner without mutating either plan.
- [x] 3.5 Add use-case and planner tests for missing compatible packs, model overrides, cache hits, identity changes, malformed output, provider failures/retry, validation failures, sparse evidence, and concurrent saves.
- [x] 3.6 Keep discarded evidence identifiers validator-side and exclude them from every initial and repair LLM payload.
- [x] 3.7 Rename prompt-facing selected input to `eligibleEvidence`, clarify eligible/used/omitted schema semantics, and bump the prompt version.
- [x] 3.8 Add one bounded full-regeneration repair for evidence membership/accounting failures using only safe issue codes and indexed paths.
- [x] 3.9 Prove repair never silently removes or mutates invalid entries, validates the complete regenerated draft, and persists nothing when repair fails.
- [x] 3.10 Clarify UUID identifier namespaces in the prompt, bump its version, and add a regression for mixed evidence/requirement IDs matching the observed failure.
- [x] 3.11 Bump the prompt version and prove a deterministic repeated `selected_and_omitted` overlap receives actionable repair context while invalid repaired output still cannot persist.
- [x] 3.12 Constrain a `selected_and_omitted` repair schema so the already-used evidence ID cannot be emitted as omitted again.
- [x] 3.13 Bump the prompt version and add a regression for a draft combining `selected_and_omitted` with `skill_promoted_to_experience`.
- [x] 3.14 Add optional regeneration IDs to job analysis, evidence reasoning, and resume planning identities so forced runs remain immutable and persist alongside cached snapshots.

## 4. Persistence and Cross-Module Input Adapters

- [x] 4.1 Add the `resume_content_plans` Drizzle table with JSON snapshot, plan/schema identity metadata, Curated Evidence Pack/job foreign keys, timestamps, lookup indexes, and a unique plan-identity constraint.
- [x] 4.2 Generate and review the additive Drizzle migration for immutable Resume Content Plan storage and verify it applies to an empty and an existing development database.
- [x] 4.3 Implement the compatible-pack input adapter with strict stored-pack parsing and deterministic `createdAt DESC, id DESC` selection.
- [x] 4.4 Implement batch loading/mapping of only selected claims' canonical presentation metadata and prove unrelated knowledge, raw source documents, retrieval, and vector access never enter planner input.
- [x] 4.5 Implement the Drizzle Resume Content Plan repository for identity lookup, insert-only persistence, strict snapshot hydration, and uniqueness-race recovery.
- [x] 4.6 Add repository/integration tests for latest-compatible selection, malformed-pack skipping, exact metadata allowlisting, round-trip hydration, immutable identity reuse, and concurrent insert behavior.

## 5. Observability and Privacy

- [x] 5.1 Add documents-specific no-op/fail-open observability contracts for planning traces, stage timing, bounded metrics, generation metadata, and flush lifecycle.
- [x] 5.2 Instrument input loading, identity/cache lookup, prompt construction, inference, schema validation, deterministic validation, persistence, cache hits, failures, and final outcomes.
- [x] 5.3 Adapt the shared OpenTelemetry and Langfuse infrastructure so planning records safe metadata and optional token usage while excluding identities from metric labels and content from default capture.
- [x] 5.4 Add tests proving exporter/Langfuse failures do not alter use-case results, cache hits emit no generation event, metric dimensions stay bounded, and prompts/evidence/generated text are absent unless explicitly opted in.

## 6. Composition and CLI

- [x] 6.1 Add a documents composition root that wires configuration, database adapters, LLM provider, validator, planner, repositories, and observability without affecting construction of existing workflows.
- [x] 6.2 Implement `pke documents resume plan <job-id>` with early validation and defaults for `--model`, `--language pt-BR|en`, `--length concise|standard|detailed`, `--json`, and `--verbose`.
- [x] 6.3 Implement exact single-document JSON output, compact terminal preview, and verbose traceability/omission/coverage/provenance output with no prompt or raw provider response leakage.
- [x] 6.4 Register the documents command tree in the CLI and add command tests for defaults, every option, invalid values, JSON stdout purity, previews, actionable missing-pack errors, cached reuse, and non-zero failures.
- [x] 6.5 Add a human feedback for long running processing as we have in `pke -- eval run` command
- [x] 6.6 Add and propagate `--force` through `jobs analyze`, `jobs reason`, `jobs candidates`, `jobs retrieve`, and `documents resume plan`, preserving the existing indexing flag.
- [x] 6.7 Add CLI and use-case regressions proving default reuse, forced provider invocation, fresh immutable persistence, and candidate/retrieval analysis refresh.

## 7. Golden Evaluation

- [x] 7.1 Extend the versioned evaluation fixture schema with read-only Curated Evidence Pack planning inputs and controlled Resume Content Planner responses.
- [x] 7.2 Add golden scenarios for valid English/Portuguese plans, concise versus detailed rich-evidence output, sparse evidence, unknown/discarded evidence, altered metrics, canonical name/date drift, unsupported technologies, skill inflation, uncovered-requirement fabrication, and identity reuse.
- [x] 7.3 Implement deterministic resume-planning assertions and reporting with stable issue paths, no LLM judge, and no canonical knowledge mutation.
- [x] 7.4 Add evaluation tests proving unsafe scenarios fail the owning assertion, valid scenarios pass reproducibly, and document evaluation does not regress existing retrieval/association/reasoning reports.

## 8. Architecture and Operations Documentation

- [x] 8.1 Update `docs/architecture.md` and the documents module documentation with the Curated Evidence Pack → Resume Content Planner → Resume Content Plan → Renderer flow, ownership, allowed dependencies, and closed-world planner boundary.
- [x] 8.2 Document plan schema/identity, deterministic validators, CLI examples/options, provider/model/prompt configuration, migration operation, immutable reuse, and troubleshooting.
- [x] 8.3 Update evaluation and observability/privacy documentation with resume golden scenarios, safe attributes/metrics, content-capture defaults, and failure isolation.
- [x] 8.4 Update the AEM-010 knowledge-products roadmap material to match JSON content planning acceptance criteria and explicitly defer rendering and other document generators.
- [x] 8.5 Document cache bypass semantics and distinguish generation reuse from ingestion idempotency, historical reads, and embedding indexing.

## 9. Verification and Regression Safety

- [x] 9.1 Add or extend architecture-boundary tests proving documents domain/application code cannot import database, jobs infrastructure, retrieval, pgvector, telemetry SDKs, CLI, or renderer implementations.
- [x] 9.2 Run `npm run typecheck`, `npm test`, and `npm run build`; fix all new and existing in-scope failures.
- [x] 9.3 Run migration verification plus CLI smoke tests for English/Portuguese, concise/detailed, JSON/preview, invalid response rejection, and repeated immutable reuse.
- [x] 9.4 Run the golden evaluation suite and confirm fabricated evidence and altered metrics fail while all existing ingestion, retrieval, jobs, claims, and evaluation workflows remain functional.
