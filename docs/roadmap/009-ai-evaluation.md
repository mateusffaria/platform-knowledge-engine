# AEM-009 — AI Evaluation

## Goal

Create an evaluation framework for AI outputs.

## Problem

Manual review does not scale.

The project needs a way to detect regressions in generated outputs, unsupported claims and quality degradation.

## Scope

- golden dataset
- regression tests
- unsupported claim detection
- hallucination checks
- ATS-style score
- output quality rubrics

## Out of Scope

- provider benchmarking
- public leaderboard
- production monitoring

## Architectural Decisions

### Golden dataset

Use fixed job descriptions and expected characteristics to evaluate outputs.

### Evaluation as engineering

Treat prompt and agent changes like code changes that can introduce regressions.

## Acceptance Criteria

- The system can evaluate generated outputs.
- Unsupported claims are detected.
- Regression tests can compare outputs over time.
- Evaluation results are persisted or exported.

## Risks

- LLM-as-judge may be inconsistent.
- Metrics may oversimplify quality.
- Golden datasets may become stale.

## Next Milestone

AEM-010 — Intelligence Benchmarking.
