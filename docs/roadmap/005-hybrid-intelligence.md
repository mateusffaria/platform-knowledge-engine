# AEM-005 — Hybrid Intelligence

## Goal

Combine structured retrieval and semantic retrieval.

## Problem

Neither SQL nor vector search alone is enough.

Structured retrieval is better for exact filters:

- skills;
- companies;
- dates;
- source status;
- validation status.

Semantic retrieval is better for meaning:

- leadership;
- systems design;
- scalability;
- ownership;
- influence.

## Scope

- query planner
- structured retrieval
- semantic retrieval
- result merging
- evidence ranking
- evidence pack builder

## Status

In implementation.

## Out of Scope

- document generation
- agent orchestration
- benchmark framework

## Architectural Decisions

### Hybrid Retrieval

Use both structured and semantic retrieval.

### Query Planner

Introduce a query planner that decides which retrieval strategies should be used.

### Evidence Pack

The output of retrieval should be an Evidence Pack, not free-form text.

### Ranking Scores

Ranking uses deterministic weights for claim status, structured exact matches, semantic similarity and confidence. The final score is only a retrieval ranking score for ordering evidence; it is not an objective probability that a claim is true.

## Acceptance Criteria

- The system can retrieve evidence using structured filters.
- The system can retrieve evidence using semantic search.
- Results are merged and ranked.
- Evidence Pack contains traceable claims.
- Rejected, superseded and needs-review claims are excluded from trusted Evidence Packs.

## Risks

- Ranking may be difficult to evaluate.
- Semantic search may return plausible but weak evidence.
- Query planning may become overly complex.

## Next Milestone

AEM-006 — Agentic Workflows.
