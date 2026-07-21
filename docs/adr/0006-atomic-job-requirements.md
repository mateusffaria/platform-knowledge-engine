# Atomic Job Requirements as the Evidence-Reasoning Unit

## Context

A parent job sentence can coordinate independently satisfiable requirements. Treating “Go and PostgreSQL” as one unit couples retrieval results, hides mixed coverage, and can let resume planning overstate an unsupported sibling.

## Decision

Preserve the extracted sentence as the provenance and compatibility parent, and introduce ordered, deterministic atomic components as the authoritative retrieval, candidate-selection, reasoning, and resume-targeting unit.

Decomposition is conservative and parser-owned. Each parent always has at least one component. Persistence is additive; legacy rows receive a deterministic in-memory singleton. LLMs may decide allowlisted component coverage but cannot create, merge, rename, or omit component identities silently. Parent coverage and summaries are pure deterministic aggregates, and resume validation enforces component-level evidence membership and missing-sibling boundaries.

## Consequences

- Mixed support remains visible without losing the original sentence or provenance.
- Retrieval and reasoner context budgets are bounded independently per component.
- Parent-level consumers remain compatible through deterministic aggregate views.
- Historical rows and immutable evidence/plan snapshots remain readable without backfill or rewrite.
- Parser conservatism can leave some compound concepts as singletons; expanding the classifier requires explicit fixtures and migration-free deterministic identity review.

