## Why

Changes to retrieval policies, evidence-pack construction, prompts, models, and reasoning logic can silently regress evidence quality. The project needs a reproducible, versioned evaluation workflow that distinguishes retrieval, association, and reasoning failures without mutating canonical knowledge or affecting normal CLI workflows.

## What Changes

- Add a hexagonal evaluation module for versioned datasets, scenarios, expectations, runs, results, aggregate metrics, and reports.
- Add fixture-based golden scenarios covering exact and conceptual coverage, genuinely missing technologies, empty candidate packs, redundant candidates, and trust-policy exclusions.
- Evaluate retrieval results, Candidate Evidence Pack association, and Curated Evidence Pack reasoning independently with deterministic expectations as the authoritative pass/fail mechanism.
- Detect fabricated or unsupported selections, invalid schemas, incorrect missing requirements, provenance gaps, evidence-set regressions, and coverage-status regressions.
- Add `pke eval list`, `pke eval run [scenario-id]`, and `pke eval show <run-id>` commands with concise, JSON, and Markdown reporting.
- Record dataset, model, provider, prompt, candidate-pack, and git versions with each run.
- Emit quality and performance metrics through existing observability contracts and attach evaluation metadata to Langfuse runs when enabled.
- Document the evaluation workflow and update the project roadmap.

## Capabilities

### New Capabilities

- `evidence-evaluation`: Versioned golden datasets, isolated pipeline-stage evaluation, deterministic assertions, persisted evaluation runs, aggregate quality and performance metrics, reports, CLI workflows, and optional observability integration.

### Modified Capabilities

None.

## Impact

- Adds `src/modules/evaluation/` with domain, application, infrastructure, and CLI boundaries.
- Integrates read-only adapters with retrieval, job-analysis/evidence-pack, persistence, logging, metrics, tracing, and Langfuse facilities.
- Adds versioned evaluation fixtures, evaluation-focused tests, CLI registration, documentation, and roadmap updates.
- May extend shared database schema and migrations for stored runs/results, while preserving canonical knowledge and claim lifecycle state.
- Evaluation backend or observability failures remain contained to evaluation commands and do not alter existing ingestion, retrieval, job, or document workflows.
