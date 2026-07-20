# AEM-009 — AI Evaluation

## Goal

Create a reproducible evaluation framework for evidence retrieval, Candidate Evidence Packs, and Curated Evidence Packs.

## Problem

Retrieval policies, prompts, models, and reasoning logic can change evidence quality without an obvious application failure. Manual review does not provide versioned, stage-attributed regression detection.

## Scope

- versioned, schema-validated golden scenarios;
- independent retrieval, candidate-association, and reasoning results;
- deterministic expected/forbidden evidence, coverage, missing-evidence, provenance, bounded-count, fabrication, and schema assertions;
- precision@K, recall@K, coverage, missing-evidence, unsupported-selection, provenance, and schema quality metrics;
- separately reported reasoning latency and token metrics;
- immutable run/result snapshots with dataset, git, model, prompt, and Candidate Evidence Pack versions;
- concise, JSON, and Markdown reports through `pke eval`;
- optional OpenTelemetry, structured-log, Grafana, and Langfuse integration.

## Out of Scope

- provider benchmarking
- public leaderboard
- production alerting
- resume or cover-letter generation
- ATS scoring or subjective writing-quality rubrics
- LLM-as-judge
- automated provider comparison or fine-tuning

## Architectural Decisions

### Golden dataset

Use immutable read-only fixture knowledge, requirements, and typed expectations. Fixtures never enter or mutate canonical knowledge.

### Evaluation as engineering

Treat prompt and agent changes like code changes that can introduce regressions.

### Deterministic authority and stage attribution

Deterministic assertions decide pass/fail. Retrieval, Candidate Evidence Pack association, and reasoning retain separate outcomes so regressions are attributed to their originating stage. Genuinely absent fixture evidence remains missing and is not treated as a recall failure.

### Quality is separate from performance

Quality metrics are never combined with latency or token usage. Undefined metric denominators are reported as not applicable.

## Acceptance Criteria

- `pke eval run` executes all six golden scenario families and `pke eval run <scenario-id>` scopes a run.
- Reports identify passed and failed expectations by scenario and pipeline stage.
- Fabricated, cross-requirement, forbidden-trust-state, and missing-provenance evidence is detected.
- Expected missing requirements are validated without penalizing a truly empty fixture store.
- Runs contain dataset/hash, git, model/provider/prompt, and Candidate Evidence Pack versions.
- Evaluation results are persisted and renderable as concise text, JSON, or Markdown.
- Quality and performance telemetry appears in the optional local observability stack.
- Existing non-evaluation workflows remain functional when evaluation storage or telemetry is unavailable.

## Risks

- Golden datasets may become stale → version and review fixtures as code.
- Model variability may produce noisy reasoning outcomes → keep assertions referential, bounded, and version-aware.
- Fixture adapters may diverge from production → reuse production application services and swap only read-only external ports.

## Next Milestone

AEM-010 — Intelligence Benchmarking.
