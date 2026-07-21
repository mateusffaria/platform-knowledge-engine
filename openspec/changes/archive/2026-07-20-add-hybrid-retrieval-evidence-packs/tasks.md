## 1. Retrieval Models and Ports

- [x] 1.1 Add retrieval domain/application types for `EvidencePack`, `EvidenceItem`, source references, retrieval strategies, query filters, score components, and ranking configuration.
- [x] 1.2 Add a `StructuredKnowledgeSearch` application port with input filters for query terms, claim status, subject type, limit, and minimum structured score.
- [x] 1.3 Add normalized hybrid candidate types that can represent structured candidates, semantic candidates, and merged candidates without depending on infrastructure adapters.
- [x] 1.4 Add default ranking configuration with constructor overrides and documentation comments that `finalScore` is a retrieval ranking score, not truth probability.

## 2. Query Planning

- [x] 2.1 Implement a deterministic `QueryPlanner` service for structured, semantic, and hybrid strategy selection.
- [x] 2.2 Add planner rules for exact skill, company, role, technology, and date-like terms.
- [x] 2.3 Add planner rules for natural-language and conceptual queries with semantic fallback.
- [x] 2.4 Add unit tests for structured-only, semantic-only, mixed-query, and empty-query planning behavior.

## 3. Hybrid Search Core

- [x] 3.1 Implement the `HybridSearch` use case with validation for query, limit, minimum score, claim status, and subject type inputs.
- [x] 3.2 Wire structured retrieval through the `StructuredKnowledgeSearch` port and preserve structured match scores and source excerpts.
- [x] 3.3 Wire semantic retrieval through the existing embedding provider and `VectorStore` path or existing semantic search use case.
- [x] 3.4 Normalize structured and semantic retrieval results into a shared candidate shape.
- [x] 3.5 Merge and deduplicate candidates by evidence claim identity, falling back to knowledge asset identity when no claim identity is available.
- [x] 3.6 Enforce trusted-output eligibility so `needs_review`, `rejected`, and `superseded` claims never appear in Evidence Packs.
- [x] 3.7 Apply deterministic ranking with status boost, structured exact-match boost, semantic similarity contribution, stable tie-breakers, limit, and minimum-score filtering.
- [x] 3.8 Return complete Evidence Packs with query, strategies, generated timestamp, ranked items, score components, provenance, excerpts, and warnings.

## 4. Infrastructure and Composition

- [x] 4.1 Implement the production structured knowledge search adapter using explicit knowledge/reconciliation application contracts rather than retrieval importing knowledge infrastructure directly.
- [x] 4.2 Update retrieval service composition to construct `HybridSearch`, `QueryPlanner`, ranking configuration, structured search, semantic search dependencies, and closeable resources.
- [x] 4.3 Ensure existing `pke search` composition and behavior remain unchanged.
- [x] 4.4 Add or update boundary tests proving retrieval application code does not import knowledge infrastructure, reconciliation infrastructure, Drizzle schema, pgvector adapters, provider SDKs, or CLI code.

## 5. CLI

- [x] 5.1 Add `pke retrieve "<query>"` to retrieval CLI handlers.
- [x] 5.2 Add and validate `--limit`, `--min-score`, `--claim-status`, `--subject-type`, `--json`, and `--verbose` options.
- [x] 5.3 Implement compact text output for ranked Evidence Items with claim, status, score, and source context.
- [x] 5.4 Implement verbose output with identifiers, strategies, score components, and source excerpts.
- [x] 5.5 Implement JSON output that prints the full Evidence Pack without losing optional score fields.
- [x] 5.6 Add CLI tests for option validation, JSON output, verbose output, ineligible claim status handling, and preservation of existing `pke search` behavior.

## 6. Documentation

- [x] 6.1 Update `src/modules/retrieval/README.md` to describe query planning, structured retrieval, semantic retrieval, deduplication, ranking, Evidence Pack fields, and warnings.
- [x] 6.2 Update `docs/architecture.md` to describe retrieval ownership and cross-module contracts for hybrid retrieval.
- [x] 6.3 Update roadmap documentation to include the hybrid retrieval and Evidence Pack milestone status and limitations.
- [x] 6.4 Document ranking weights and clarify that final scores are retrieval ranking scores, not objective truth probabilities.

## 7. Verification

- [x] 7.1 Add hybrid search tests for structured-only matches, semantic-only matches, duplicate results returned by both strategies, deterministic ordering, and provenance preservation.
- [x] 7.2 Add tests proving rejected, superseded, and needs-review claims are excluded from Evidence Packs and cannot be opted into as trusted evidence.
- [x] 7.3 Add tests proving confirmed claims outrank equivalent single-source claims and exact structured matches receive the configured boost.
- [x] 7.4 Add tests proving retrieval limit and minimum-score filtering are applied after merge and ranking.
- [x] 7.5 Run `npm run typecheck`.
- [x] 7.6 Run `npm test`.
