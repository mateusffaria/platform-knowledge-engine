## Context

Professional Knowledge Engine already separates ingestion, knowledge persistence, reconciliation, and semantic retrieval. The retrieval module can index eligible knowledge with embeddings and search pgvector through the `VectorStore` port, while reconciliation owns claim status and eligibility policy. What is missing is an application-level retrieval capability that can combine exact structured facts with semantic matches and return a ranked, traceable Evidence Pack.

This design must keep retrieval as the owner of query planning, structured retrieval orchestration, semantic retrieval orchestration, result merging, deduplication, ranking, and Evidence Pack generation. Retrieval may consume knowledge and reconciliation data through explicit application contracts, but it must not import knowledge, reconciliation, Drizzle, pgvector, or provider infrastructure from its domain or use-case layer.

## Goals / Non-Goals

**Goals:**

- Introduce a deterministic `HybridSearch` use case that returns an Evidence Pack for `pke retrieve "<query>"`.
- Add a deterministic query planner that selects structured, semantic, or hybrid retrieval without using an LLM.
- Add a `StructuredKnowledgeSearch` port for exact matches against eligible professional facts and source context.
- Reuse the existing `VectorStore` and embedding provider contracts for semantic retrieval.
- Merge and deduplicate results by evidence claim identity when present, then by knowledge asset identity when a claim identity is unavailable.
- Preserve claim status, confidence, source references, source excerpts, structured score, semantic score, final ranking score, generation timestamp, and warnings.
- Keep existing `pke search` semantic-search behavior functional.

**Non-Goals:**

- LLM-based query planning, reranking, summarization, or truth resolution.
- Resume generation, job-description parsing, agent orchestration, benchmarking, UI/dashboard work, or cross-encoder ranking.
- Moving reconciliation, claim eligibility decisions, ingestion, or document generation responsibilities into retrieval.

## Decisions

1. Retrieval owns Evidence Pack generation as a use case, not as CLI formatting.

   The `HybridSearch` use case will produce an `EvidencePack` domain result that CLI handlers can print as compact text, verbose text, or JSON. This keeps downstream document-generation use cases able to consume the same structured result without scraping terminal output.

   Alternative considered: format the pack only in the CLI. That would be faster initially but would make the Evidence Pack unusable as an application contract.

2. Query planning will be deterministic and rule-based.

   A `QueryPlanner` service will classify a trimmed query into `structured`, `semantic`, or both. Exact skill, company, role, technology, and date-like terms will trigger structured retrieval. Natural-language or conceptual phrasing will trigger semantic retrieval. Mixed queries will run both strategies. The planner will return the selected strategies and any extracted structured filters or terms needed by the structured port.

   Alternative considered: use an LLM planner. That is out of scope for this milestone and would make planning nondeterministic unless carefully constrained.

3. Structured retrieval will be represented by a retrieval-owned port.

   The retrieval module will define `StructuredKnowledgeSearch` in its application ports. Production composition can satisfy it with a knowledge-side or shared infrastructure adapter that reads eligible claim and source data, but retrieval use cases will depend only on the port. The port result will include claim identity when available, knowledge asset identity, claim type, claim text, claim status, confidence score, structured match score, source references, and excerpts.

   Alternative considered: have `HybridSearch` query knowledge repositories directly. That would violate the modular monolith boundary and couple retrieval to persistence details.

4. Semantic retrieval will reuse the existing `SearchKnowledge` path internally.

   `HybridSearch` can either call the existing semantic search use case or use the same `EmbeddingProvider` and `VectorStore` ports. In both cases, semantic results must be normalized into the same candidate shape as structured results before merging. The existing `pke search` command remains a semantic-only command and should not change user-visible behavior.

   Alternative considered: create a second vector search contract for hybrid retrieval. That would duplicate behavior and increase the chance that `pke search` and hybrid search diverge.

5. Deduplication and ranking will be deterministic and explicit.

   Candidates will be deduplicated first by `evidenceClaimId` when present. Candidates without a claim id will be deduplicated by `knowledgeAssetId`. When both structured and semantic results point to the same evidence item, the merged item will preserve both scores. Ranking will use configurable weights for claim status, structured exact-match boost, and semantic similarity, while documenting that `finalScore` is a retrieval score rather than an objective probability of truth.

   Alternative considered: rank by semantic similarity alone. That would underweight exact structured matches and trust status, which are core to the Evidence Pack contract.

6. Eligibility filtering will be enforced at retrieval output.

   The structured search port should return eligible evidence by default, and semantic indexing should already exclude ineligible claims. `HybridSearch` will still enforce that only `confirmed` and `single_source` claims appear in Evidence Packs unless the caller narrows to one of those allowed statuses. `needs_review`, `rejected`, and `superseded` claims will not be returned as trusted evidence.

   Alternative considered: rely only on upstream indexing and repository filters. A final application-level guard makes the Evidence Pack contract safer and easier to test.

## Risks / Trade-offs

- Structured and semantic results may expose different score ranges -> Normalize candidate scores before final ranking and document each score field separately.
- Query planning rules may miss some exact terms -> Keep the planner deterministic, small, and covered by tests; unknown queries can fall back to semantic retrieval.
- Deduplicating asset-only results can hide multiple useful claims from the same asset -> Prefer evidence claim identity whenever available and only use asset identity as a fallback.
- Final scores can be misread as truth probabilities -> CLI and docs must describe them as retrieval ranking scores, not factual certainty.
- Cross-module adapters can blur ownership boundaries -> Add tests or import checks that retrieval use cases depend on ports and do not import knowledge or reconciliation infrastructure.

## Migration Plan

1. Add retrieval domain/application models and ports without changing existing CLI behavior.
2. Implement `HybridSearch` with mocked ports and focused unit tests for planning, merging, deduplication, eligibility, and ranking.
3. Add production structured-search and semantic-search wiring through the composition root.
4. Add `pke retrieve "<query>"` alongside the existing `pke search "<query>"`.
5. Update retrieval, architecture, and roadmap documentation.
6. Run `npm run typecheck` and `npm test`.

Rollback is low risk because the new command and use case are additive. If production wiring has issues, unregister `pke retrieve` while leaving existing `pke search`, indexing, ingestion, and reconciliation behavior unchanged.

## Open Questions

- Should ranking weights live in shared config immediately, or start as retrieval defaults with optional constructor overrides?
- Should `--subject-type` filter only semantic subject types initially, or map to structured claim/entity categories as well?
