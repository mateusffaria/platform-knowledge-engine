## Context

The retrieval and jobs modules now produce three useful boundaries for quality evaluation: ranked retrieval `EvidencePack` values, requirement-scoped `CandidateEvidencePack` values, and schema-validated `CuratedEvidencePack` values. Tests cover individual deterministic transformations, and reasoning observability measures operational behavior, but there is no versioned dataset that executes these boundaries together and compares their outputs with golden expectations. Prompt, model, ranking, trust-policy, and association changes can therefore regress quality without identifying the stage that introduced the failure.

Evaluation must remain an engineering workflow rather than a new source of professional truth. Golden data is versioned test input, canonical knowledge is read-only, deterministic assertions own pass/fail, and telemetry or evaluation persistence failures must never be coupled into existing ingestion, retrieval, jobs, or document commands. Model-backed reasoning may vary, but its output is assessed by deterministic referential, coverage, provenance, and schema rules; an LLM judge is not part of this milestone.

## Goals / Non-Goals

**Goals:**

- Execute all or one versioned golden scenario through independently identifiable retrieval, candidate-association, and reasoning stages.
- Represent datasets, scenarios, expectations, runs, stage results, assertion results, and reports as evaluation-owned domain models.
- Detect wrong or missing evidence, forbidden trust states, unsupported selections, fabricated IDs, incorrect missing requirements, coverage regressions, provenance gaps, and invalid output schemas.
- Persist auditable run/result snapshots with dataset, git, candidate-pack, prompt, provider, and model versions.
- Report per-stage failures and aggregate quality metrics separately from latency and token metrics.
- Reuse the existing fail-open OpenTelemetry and Langfuse infrastructure through narrow evaluation ports.

**Non-Goals:**

- Resume or cover-letter generation, subjective writing-quality scoring, ATS scoring, LLM-as-judge, fine-tuning, provider comparison, a model leaderboard, or production alerting.
- Mutating canonical knowledge, promoting or reconciling claims, or using an evaluation result as a trust decision.
- Making model output deterministic; deterministic assertions over a versioned input and output contract are the authority.

## Decisions

### Add a self-contained evaluation module with explicit ports

Create `src/modules/evaluation/` using the repository's domain, application, infrastructure, and `interfaces/cli` boundaries. The domain defines `EvaluationDataset`, `EvaluationScenario`, `EvaluationExpectation`, `EvaluationRun`, `EvaluationResult`, stage and assertion outcomes, version metadata, metric summaries, and report models. Application use cases list datasets/scenarios, run a selected scope, assert each stage, calculate aggregates, store the completed snapshot, and render a report.

The application depends on narrow ports for dataset loading, pipeline execution, run persistence, clock/ID/git-version resolution, telemetry, and optional evaluation tracing. A production composition root adapts existing retrieval and jobs use cases to the pipeline port; the evaluation domain does not import their infrastructure, database schema, provider SDKs, Commander, or Langfuse.

Alternative considered: add evaluation switches directly to retrieval and jobs commands. That would distribute evaluation policy across business modules and make isolation, aggregation, and stage attribution difficult.

### Use immutable, schema-validated fixtures and isolated pipeline inputs

Store golden datasets under a versioned evaluation fixture directory. A dataset manifest declares a stable dataset ID and version, scenario files, fixture/schema versions, requirements, canonical evidence and provenance, trust states, stage inputs, and expectations. Loaders validate every file before executing a run, reject duplicate or dangling IDs, sort scenarios and expectation inputs stably, and hash normalized dataset content for auditability.

Pipeline execution receives scenario-owned fixture values through evaluation adapters. Retrieval uses the current planner, eligibility, merging, and ranking behavior against fixture-backed knowledge/vector ports; candidate association uses current candidate-pack construction against the same immutable fixture graph; reasoning receives the scenario's resulting or explicitly supplied Candidate Evidence Pack. Fixture adapters expose no save, status-transition, reconciliation, or promotion capability. Evaluation-run persistence is separate from fixture/canonical knowledge storage.

This arrangement exercises current policies while proving that `eval` cannot alter the user's canonical store. It also lets genuinely unsupported requirements be declared missing from the closed fixture world rather than penalizing the pipeline for absent evidence.

Alternative considered: seed the normal canonical database and clean it up afterward. Even transaction rollback would create an unnecessary mutation path and makes crash recovery and parallel runs risky.

### Execute and classify the three stages independently

An `EvaluationPipeline` returns separate typed outcomes for `retrieval`, `candidate_association`, and `reasoning`, each containing its input identity, schema-valid output when available, timing, token usage when applicable, and a sanitized execution error when unavailable. The runner executes stages in order when upstream inputs are needed, but assertions and results retain stage ownership. If an upstream stage cannot provide a required downstream input, the downstream stage is recorded as blocked rather than misreported as a failed reasoning assertion. Scenarios may supply a fixed Candidate Evidence Pack to isolate reasoning from retrieval and association.

The runner continues across independent scenarios after a scenario execution failure, persists all completed/failed/blocked stage results, and returns a failed run when any required stage execution or authoritative assertion fails. This distinguishes a retrieval ranking regression, an association/hydration regression, and a reasoning selection/coverage regression in CLI and exported reports.

Alternative considered: compare only the final Curated Evidence Pack. That would hide where candidates were lost or unsupported selections entered the pipeline.

### Model expectations as deterministic, stage-scoped assertions

`EvaluationExpectation` is a discriminated union with a stable expectation ID, target stage, and typed parameters. Initial assertion types cover expected/forbidden evidence IDs, top-K evidence membership and maximum evidence count, minimum/maximum coverage status, expected missing requirements, required provenance fields, selected-ID membership in the supplied Candidate Evidence Pack, no fabricated evidence, and deterministic schema validity. Trust-policy fixtures express rejected, superseded, and `needs_review` IDs as forbidden at retrieval and downstream stages.

The assertion engine never asks a model to judge its own output. Every result records expected and observed safe identifiers/counts, pass/fail, and a machine-readable reason code. Coverage ordering is fixed as `missing < weak < partial < strong`. Missing requirements pass only when the dataset's closed fixture graph declares no eligible supporting evidence and the output keeps them missing; such requirements are excluded from evidence recall denominators so absence is not treated as a retrieval miss.

Alternative considered: snapshot entire rendered outputs. Whole-output snapshots are brittle to harmless wording/order changes and cannot attribute meaningful regressions.

### Calculate quality and performance metric groups separately

Quality aggregation uses stable expectation sets and declared K values. For a stage, precision@K is relevant expected IDs among the first K observed IDs divided by observed IDs up to K; recall@K is relevant expected IDs found in the first K divided by eligible expected IDs. Requirement coverage accuracy and missing-evidence accuracy are exact matches over applicable requirements. Unsupported-selection rate is selected IDs absent from that requirement's supplied Candidate Evidence Pack divided by all selections. Provenance completeness is selected/retrieved evidence satisfying declared provenance fields divided by applicable evidence. Schema-validation success rate is valid stage outputs divided by attempted outputs.

Performance aggregation contains average reasoning latency and total/average prompt and completion tokens when providers report them. Undefined denominators produce `notApplicable`, not zero. Reports label both groups explicitly and retain per-scenario samples so a fast failure cannot look like a quality improvement.

Alternative considered: combine quality and latency into a composite score. It would obscure regressions and imply an unsupported trade-off between correctness and speed.

### Persist immutable run snapshots and render three report formats

Add evaluation-owned run and result persistence, preferably `evaluation_runs` plus `evaluation_results`. A run stores its ID, dataset ID/version/hash, started/completed times, status, requested scenario when present, git SHA, provider/model/prompt version when reasoning ran, candidate-pack versions encountered, aggregate quality/performance JSON, and report schema version. Results store run/scenario/stage identity, status, version metadata, assertion details, sanitized diagnostics, timing/tokens, and output summaries required to reproduce the report. Full prompt/provider response content is not required.

`pke eval list` shows validated datasets and scenarios. `pke eval run [scenario-id]` executes the default golden dataset and prints concise output by default; `--format json|markdown` emits stable report schemas and `--output <path>` optionally writes the selected representation. `pke eval show <run-id>` renders a persisted run through the same format options. Human output groups failures by scenario and stage and exits non-zero for a failed or errored run.

Alternative considered: write reports only to files. Persisted normalized snapshots are needed for `show`, while stdout-first rendering composes better with a local CLI.

### Extend observability through evaluation-specific, fail-open contracts

Add evaluation metric names and bounded attributes to the shared telemetry facade without reusing reasoning-only metric keys. Emit run/scenario/assertion outcomes and the required aggregate quality metrics, plus reasoning latency and prompt/completion token metrics. Dataset version, stage, provider, model, prompt version, and outcome are bounded attributes; run IDs, scenario IDs, evidence IDs, candidate hashes, and git SHA stay in traces/logs rather than metric labels.

When Langfuse is enabled, create an evaluation run trace and attach dataset/version/hash, scenario, git SHA, model/provider/prompt version, candidate-pack version, stage outcomes, and aggregate metrics. Existing privacy defaults remain: no canonical evidence, prompt, or completion content is attached unless separately opted in. Telemetry and Langfuse calls are fail-open within evaluation, while construction and failures of the evaluation module remain unreachable from non-evaluation CLI composition paths.

Alternative considered: make telemetry export part of evaluation success. Backend availability is operational state, not evidence-quality behavior, and must not change assertion results.

## Risks / Trade-offs

- [Golden fixtures drift from real canonical data] → Version datasets, document fixture provenance, validate schemas/hashes, and review scenario changes like code.
- [Model variability causes noisy reasoning outcomes] → Keep assertions referential and bounded, record all model/prompt/input versions, allow reasoning-only scenarios, and avoid subjective text judgments.
- [Fixture adapters diverge from production adapters] → Reuse production application services and swap only external data/provider ports; add contract tests that compare adapter shapes.
- [An upstream failure is blamed on reasoning] → Persist explicit passed/failed/errored/blocked stage statuses and never run downstream assertions without their required typed input.
- [Metric labels become high cardinality] → Allow only bounded version/stage/outcome dimensions in metrics and keep identities in traces, logs, and persisted results.
- [Run persistence or observability is unavailable] → Fail the explicit `eval` command with an actionable diagnostic when its required repository is unavailable, keep telemetry fail-open, and instantiate neither dependency for normal commands.
- [Golden data accidentally mutates canonical state] → Give fixture adapters read-only interfaces, test that mutation ports are absent, and keep run/result tables separate from canonical knowledge tables.

## Migration Plan

1. Add evaluation domain models, fixture schemas/loaders, assertion engine, aggregation, reporters, and deterministic unit tests.
2. Add fixture-backed pipeline adapters and the initial six golden scenarios, then test stage isolation and canonical-store immutability.
3. Add evaluation run/result tables, migration, repositories, and immutable run snapshots; no existing row requires backfill.
4. Compose evaluation-only production services, register `eval list`, `eval run`, and `eval show`, and add JSON/Markdown export tests.
5. Extend telemetry/Langfuse adapters, dashboards or queries, documentation, and AEM-009 roadmap material; verify backend failures do not affect existing workflows.
6. Run type checking, the full test suite, migration checks, CLI golden smoke runs, and observability-stack verification. Rollback removes the additive command/composition wiring; evaluation tables and exported reports can remain without affecting canonical data.

## Open Questions

- None. The initial dataset uses a repository-owned default golden dataset and deterministic fixture adapters; multi-dataset selection and provider comparison can be added in later milestones without changing the core run/result contracts.
