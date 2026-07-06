# AEM-008 — AI Observability

## Goal

Add first-class AI observability.

## Problem

AI systems are difficult to operate without visibility into prompts, retrieval, token usage, cost, latency and outputs.

Traditional logs are not enough.

## Scope

- Langfuse integration
- prompt tracing
- model metadata
- token usage
- cost tracking
- latency tracking
- retrieved evidence tracking
- correlation with application logs

## Out of Scope

- full automated evaluation
- LLM benchmarking
- production dashboards

## Architectural Decisions

### Separate AI observability from application observability

Application observability answers:

> Is the system healthy?

AI observability answers:

> Did the model behave correctly?

### Provider abstraction

Observability should be abstracted so the system is not tightly coupled to Langfuse.

## Acceptance Criteria

- LLM calls are traced.
- Retrieval context is traceable.
- Token usage and latency are captured.
- Traces can be correlated with CLI commands.

## Risks

- Observability can leak sensitive professional data.
- Too much tracing can create noise.
- Self-hosted tooling may add operational cost.

## Next Milestone

AEM-009 — AI Evaluation.
