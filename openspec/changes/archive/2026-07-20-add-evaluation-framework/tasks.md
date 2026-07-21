## 1. Evaluation Domain and Module Boundaries

- [x] 1.1 Create the `src/modules/evaluation/` hexagonal directory structure and export only domain/application contracts across module boundaries.
- [x] 1.2 Define `EvaluationDataset`, `EvaluationScenario`, typed `EvaluationExpectation`, `EvaluationRun`, stage/result, assertion, version metadata, metric-group, and report domain models.
- [x] 1.3 Define ports for dataset loading, isolated pipeline execution, run/result persistence, clock/ID/git metadata, evaluation telemetry, and optional Langfuse tracing.
- [x] 1.4 Add architecture tests proving evaluation domain/application code does not import database schemas, provider SDKs, Commander, Langfuse, or other module infrastructure.

## 2. Versioned Dataset and Golden Fixtures

- [x] 2.1 Implement Zod schemas and a filesystem dataset loader that validates stable IDs, versions, expectation types, referential integrity, uniqueness, normalized ordering, and deterministic dataset hashes.
- [x] 2.2 Implement immutable fixture-backed knowledge, structured-search/vector, canonical hydration, and job/candidate inputs without exposing canonical mutation or claim-transition operations.
- [x] 2.3 Add the exact-technology scenario for TypeScript, Node.js, and PostgreSQL with ranked evidence, coverage, schema, and provenance expectations.
- [x] 2.4 Add the conceptual-leadership scenario that expects leadership evidence and forbids unrelated performance-only evidence.
- [x] 2.5 Add missing-technology and empty-candidate-pack scenarios that keep Kubernetes or Flutter and every empty-pack requirement missing without fabricated evidence.
- [x] 2.6 Add redundant-candidate and trust-policy scenarios that prefer complementary strong evidence, reject weaker duplicates, and exclude rejected, superseded, and `needs_review` claims.
- [x] 2.7 Add loader/fixture tests for deterministic hashes, stable ordering, duplicate IDs, dangling references, closed-world missing evidence, and proof that canonical repositories are never mutated.

## 3. Deterministic Assertions and Metrics

- [x] 3.1 Implement stage-scoped assertions for expected/forbidden/top-K evidence IDs, maximum evidence count, coverage bounds, expected missing requirements, required provenance, Candidate Evidence Pack membership, no fabricated evidence, and schema validity.
- [x] 3.2 Add safe assertion diagnostics with stable expectation IDs, machine-readable reason codes, expected/observed values, and the fixed `missing < weak < partial < strong` coverage ordering.
- [x] 3.3 Implement quality aggregation for precision@K, recall@K, coverage accuracy, missing-evidence accuracy, unsupported-selection rate, provenance completeness, and schema-validation success rate with explicit not-applicable values.
- [x] 3.4 Implement a separate performance aggregation for reasoning latency and available prompt/completion token samples without affecting quality pass/fail.
- [x] 3.5 Add focused tests for every assertion type, genuinely absent evidence denominators, unknown and cross-requirement selections, exact metric formulas, and unavailable token usage.

## 4. Evaluation Runner and Stage Attribution

- [x] 4.1 Implement adapters that invoke current retrieval planning/ranking/eligibility and Candidate Evidence Pack construction against read-only scenario fixtures.
- [x] 4.2 Implement the reasoning-stage adapter using the existing evidence reasoner with either upstream or explicitly supplied Candidate Evidence Packs and captured version/timing/token metadata.
- [x] 4.3 Implement the run use case to execute all or one scenario in stable order, assert retrieval/association/reasoning independently, continue after independent scenario failures, and mark dependent stages blocked.
- [x] 4.4 Compute final run status and aggregate quality/performance summaries without conflating failed assertions, execution errors, or blocked stages.
- [x] 4.5 Add runner tests that distinguish retrieval, association, and reasoning regressions; exercise reasoning-only input; continue mixed runs; and verify no canonical knowledge or claim state changes.

## 5. Persistence and Reproducibility

- [x] 5.1 Add `evaluation_runs` and `evaluation_results` schema definitions for immutable run metadata, stage outcomes, assertion details, safe diagnostics, output summaries, timings/tokens, aggregate metrics, and report schema version.
- [x] 5.2 Generate and review the additive Drizzle migration, indexes, foreign keys, and JSON types with no backfill or foreign-key path into mutable canonical claim state.
- [x] 5.3 Implement and test the evaluation repository adapter for atomic run/result persistence and historical run loading without rerunning the pipeline.
- [x] 5.4 Record dataset ID/version/hash, git SHA, requested scenario scope, provider/model/prompt versions, all candidate-pack versions, timestamps, and terminal status on persisted runs.

## 6. Reports and CLI

- [x] 6.1 Implement one report model with concise text, stable lossless JSON, and Markdown renderers that group assertion and execution outcomes by scenario and stage.
- [x] 6.2 Support stdout export and optional `--output <path>` writing for `--format cli|json|markdown`, with safe overwrite/error handling and deterministic output tests.
- [x] 6.3 Register `pke eval list`, `pke eval run [scenario-id]`, and `pke eval show <run-id>` through evaluation-only composition so non-evaluation commands do not initialize evaluation storage or providers.
- [x] 6.4 Return non-zero status for failed/errored runs and actionable errors for invalid datasets, unknown scenarios, unavailable evaluation storage, and unknown run IDs.
- [x] 6.5 Add CLI tests for listing all six scenario families, full and scoped runs, concise failure attribution, JSON/Markdown export, historical `show`, and unaffected existing command construction.

## 7. Observability Integration

- [x] 7.1 Extend the shared telemetry facade with evaluation-specific run, stage, assertion, quality, reasoning-latency, and token metric names and a bounded attribute allowlist.
- [x] 7.2 Implement evaluation OpenTelemetry/logging instrumentation that keeps run/scenario/evidence identities out of metric labels while preserving them safely in traces and structured logs.
- [x] 7.3 Implement the Langfuse evaluation adapter with dataset/version/hash, git SHA, provider/model/prompt version, candidate-pack version, stage outcomes, and aggregate metrics while excluding professional and model content by default.
- [x] 7.4 Add no-op and throwing-adapter tests proving telemetry/Langfuse failures do not change evaluation assertions and evaluation backend failures do not affect normal CLI workflows.
- [x] 7.5 Extend local observability queries or dashboards and static verification to expose evaluation quality separately from latency and token metrics.

## 8. Documentation and Verification

- [x] 8.1 Add evaluation documentation covering CLI usage, dataset authoring/versioning, fixture isolation, expectations, metric formulas, report schemas, model configuration, observability, privacy, and failure behavior.
- [x] 8.2 Update `docs/roadmap.md`, `docs/roadmap/009-ai-evaluation.md`, architecture documentation, and relevant module READMEs to match the deterministic AEM-009 scope and exclusions.
- [x] 8.3 Run `npm run typecheck`, `npm test`, database migration checks, and OpenSpec validation; fix all evaluation-related failures.
- [x] 8.4 Smoke-test `pke eval list`, the full golden run, a scoped scenario, JSON/Markdown export, historical `show`, and evaluation telemetry against the configured local stack.

## 9. Long-Running CLI Feedback

- [x] 9.1 Add transient elapsed-time progress to `pke eval run` through dataset loading, scenario execution, report preparation, telemetry flush, and resource shutdown with `--no-progress` support.
- [x] 9.2 Suppress progress for machine-readable and non-interactive execution, and update CLI tests, documentation, and the evaluation specification.
