# Bounded Evidence Reasoning Over Candidate Evidence Packs

## Context

Hybrid retrieval can return trusted, ranked canonical evidence for a job, but ranking does not explain requirement coverage, complementary support, or limitations. An LLM can improve curation only if it cannot expand the evidence boundary or rewrite professional facts.

## Decision

Jobs owns a bounded `EvidenceReasoner` application port. It receives a versioned Candidate Evidence Pack built outside the reasoner from preselected, claim-addressable canonical evidence. The reasoner has no database, repository, vector-store, retrieval, search, filesystem, or tool access.

The model emits referential JSON: requirement IDs, evidence-claim IDs, qualitative coverage, and bounded explanations. Runtime schemas reject malformed, unknown, duplicate, contradictory, and out-of-scope references. The application reconstructs all canonical content, provenance, trust status, and objective signals from the input pack. It deterministically removes redundant cross-requirement selections and computes any optional numeric display score from finalized qualitative coverage.

Successful Curated Evidence Packs are immutable records keyed by job, selected analysis, candidate-pack hash/version, provider, model, and prompt version. Equivalent requests reuse the existing result. Provider completion and validation/finalization are traced through the existing observability boundary without recording raw invalid output.

## Consequences

- The LLM may select, reject, compare, and explain evidence but cannot create evidence, change trust, or prove hiring qualification.
- Invalid output fails before persistence and cannot modify candidate evidence or prior curated runs.
- Cross-requirement deduplication and display scoring are repeatable application behavior instead of provider behavior.
- The CLI can show coverage and limitations while retaining canonical evidence traceability.
