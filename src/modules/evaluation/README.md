# Evaluation Module

The evaluation module owns versioned golden datasets, deterministic stage assertions, aggregate quality/performance metrics, immutable evaluation runs, reports, and `pke eval` commands.

Its application core depends on ports for dataset loading, pipeline execution, persistence, runtime metadata, and observability. Infrastructure adapters exercise current retrieval eligibility/ranking and Candidate Evidence Pack construction against read-only fixture values. An injected evidence reasoner can evaluate the current model/prompt; fixture reasoning keeps provider-free regression tests deterministic.

Evaluation does not own canonical knowledge, claim status, retrieval policy, Candidate Evidence Pack construction, or reasoning policy. It cannot mutate or promote claims. See [Evidence Evaluation](../../../docs/evaluation.md) for CLI, fixture, metric, reporting, and observability details.
