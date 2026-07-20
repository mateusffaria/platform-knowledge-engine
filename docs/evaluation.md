# Evidence Evaluation

The evaluation module detects quality regressions in retrieval, Candidate Evidence Pack association, Curated Evidence Pack reasoning, and Resume Content Planning. It treats deterministic assertions over versioned golden fixtures as authoritative; it does not use an LLM judge or score writing style.

## CLI

Apply database migrations before persisting the first run:

```bash
npm run db:migrate
npm run pke -- eval list
npm run pke -- eval run
npm run pke -- eval run exact-technology-coverage
npm run pke -- eval show <run-id>
```

The default report is concise. JSON and Markdown use the same `evaluation-report-v1` model:

```bash
npm run pke -- eval run --format json
npm run pke -- eval run --format markdown --output evaluation-report.md
npm run pke -- eval show <run-id> --format json
```

`--output` creates a new file and refuses to overwrite an existing path. Failed assertions and stage execution errors return a non-zero exit status. A historical `show` renders the immutable stored snapshot and never reruns the pipeline.

Interactive `eval run` commands show transient elapsed-time feedback while loading the dataset, executing scenarios, storing the report, flushing telemetry, and closing resources. Progress is disabled for JSON/Markdown output, CI, and non-interactive terminals; pass `--no-progress` to disable it explicitly.

When `LLM_PROVIDER` and `LLM_MODEL` are configured, the reasoning stage invokes the existing bounded evidence reasoner. Without them, the repository-owned fixture reasoning outputs make the deterministic framework runnable without provider credentials. Every run records the effective provider/model/prompt versions, Candidate Evidence Pack versions, dataset version/hash, and git SHA.

## Golden dataset

The evidence dataset is `src/modules/evaluation/fixtures/golden-v1.json`; the versioned companion `resume-planning-golden-v1.json` adds controlled planning responses to the same default run. Their manifest data has schema versions, stable dataset/scenario identities, and stable requirement, evidence, and expectation IDs. The loader validates Zod structure, uniqueness, all references, stable ordering, and a SHA-256 hash before execution.

To add a scenario:

1. Add a unique kebab-case scenario ID and description.
2. Declare the closed-world requirements and evidence fixtures, including trust status and provenance.
3. Associate eligible evidence with requirement IDs. Omit associations where evidence is genuinely absent or irrelevant.
4. Add stage-scoped expectations with stable IDs.
5. Increment the dataset version whenever fixture input or expectations change.
6. Run the dataset, assertion, runner, and full test suites.

Fixtures are read-only values. Evaluation adapters expose no canonical save, reconciliation, promotion, rejection, or claim-transition operation. Only evaluation-owned run/result tables are written.

## Deterministic expectations

Supported expectation types are:

- `expected_evidence_ids` and `top_k_evidence`;
- `forbidden_evidence_ids`;
- `maximum_evidence_count`;
- `coverage_range`, using `missing < weak < partial < strong`;
- `expected_missing_requirements`;
- `required_provenance`;
- `candidate_membership` and `no_fabricated_evidence`;
- `schema_validity`.
- `resume_plan_validity`, including required deterministic issue codes;
- `resume_plan_identity_reuse`.

The `resume_planning` stage invokes the real strict Resume Content Plan schema and deterministic validator against read-only Curated Evidence Pack fixtures. Scenarios cover bilingual and bounded valid output, sparse evidence, fabricated/discarded evidence, altered metrics, canonical organization drift, unsupported technologies, skill inflation, uncovered requirements, locale mismatch, malformed structure, and immutable identity reuse. Controlled provider responses make these assertions reproducible and keep LLM benchmarking and subjective prose judgment out of scope.

Every assertion result records its scenario, owning pipeline stage, expectation ID/type, pass/fail outcome, machine-readable reason code, and safe expected/observed identifiers or counts. Missing requirements pass only when the closed fixture world has no eligible supporting evidence; they are not counted as retrieval recall misses.

## Metrics

Quality metrics are separate from performance metrics:

- Precision@K = expected relevant IDs observed in the first K / observed IDs up to K.
- Recall@K = expected relevant IDs observed in the first K / eligible expected IDs.
- Requirement coverage accuracy = passing coverage expectations / applicable coverage expectations.
- Missing-evidence accuracy = correctly missing requirements / expected missing requirements.
- Unsupported-selection rate = selections outside their requirement candidate scope / all selections.
- Provenance completeness = evidence satisfying all declared provenance fields / applicable evidence.
- Schema-validation success = schema-valid attempted stage outputs / attempted stage outputs.

An undefined denominator is reported as `not_applicable`, never as zero. Performance reports average reasoning latency and prompt/completion token samples only when available. Performance never changes quality pass/fail.

## Observability and privacy

With `OTEL_ENABLED=true`, evaluation emits `pke.eval.*` run/stage/assertion, quality, latency, and token metrics. Resume planning separately emits `pke.documents.resume.plan.*` duration, inference, token, validation-failure, and cache-hit metrics. Metric labels use only bounded dataset-version, stage, provider/model/prompt-version, language/length, and outcome dimensions. The provisioned **PKE Evaluation Quality** dashboard keeps quality panels separate from latency and token panels.

The application emits one wide `evaluation.run.completed` structured event containing safe run/version identities, stage/assertion counts, outcomes, and aggregate metrics. When Langfuse is configured, evaluation attaches dataset/version/hash, git SHA, provider/model/prompt, Candidate Evidence Pack versions, stage outcomes, and aggregate metrics. Canonical evidence, prompts, and model completions are excluded by default.

Telemetry and Langfuse failures are fail-open and do not change assertion results. Evaluation storage or dataset failures fail only the explicit `eval` command; normal ingestion, claims, retrieval, jobs, and documents command composition remains independent.
