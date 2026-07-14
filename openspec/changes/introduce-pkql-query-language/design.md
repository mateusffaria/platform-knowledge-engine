## Context

The retrieval module currently accepts raw query text and asks `QueryPlanner` to infer whether structured retrieval, semantic retrieval, or both should run. That inference includes natural-language shape checks, generic structured cues, and metadata lookup in the same class.

PKQL introduces a stable boundary before planning: parse the user's query into a canonical AST, then let the planner select retrieval strategies from that AST. This keeps human-written and agent-generated queries deterministic while preserving natural-language search as the fallback for unstructured text.

## Goals / Non-Goals

**Goals:**
- Add PKQL parsing for explicit filters and remaining semantic text.
- Represent parsed retrieval intent as a typed Query AST.
- Update `QueryPlanner` so it consumes parsed query intent instead of performing lexical classification over raw text.
- Keep structured matching metadata-driven through `KnowledgeMetadataProvider`.
- Preserve existing natural-language, structured-only, and mixed retrieval flows.

**Non-Goals:**
- No LLM-based query planning.
- No agent orchestration or document generation behavior.
- No advanced boolean operators, grouping, negation, ranges beyond initial date filters, or ranking redesign.
- No database migration unless implementation discovers that structured search needs additional indexed columns.

## Decisions

1. Parse PKQL before planning.

   `HybridSearch` will parse `input.query` into a `QueryAst` before invoking the planner, or the planner will own a parser dependency and immediately convert raw input to an AST at its boundary. The important contract is that planning decisions operate on `QueryAst`, not unparsed text.

   Alternative considered: extend the existing `QueryPlanner.plan(rawQuery)` heuristics. That would keep the current class smaller in the short term, but it preserves the ambiguity this change is meant to remove.

2. Model filters as typed field/value pairs with original text retained.

   The AST should include the original query, normalized semantic text, and a list of filters. Each filter should include a constrained field name, the parsed value, and enough original/raw value information to support diagnostics and future display.

   Alternative considered: translate filters immediately into flat `structuredTerms`. That would be easy to thread through existing code, but it loses the distinction between `company:VTEX`, `technology:Go`, and a generic term before structured retrieval can use it.

3. Keep metadata resolution outside the parser.

   The parser should recognize PKQL syntax and field names only. It should not decide whether `Go` is a known technology, whether `VTEX` is present in the knowledge store, or whether a project exists. Metadata-backed matching remains planner or structured-search behavior through `KnowledgeMetadataProvider`.

   Alternative considered: have the parser validate filter values against metadata. That makes parse results depend on current knowledge state and blurs syntax validation with retrieval planning.

4. Fail clearly for unsupported explicit PKQL filters.

   Queries that use `name:value` syntax with an unsupported filter name should receive a validation error. This prevents agents from issuing misspelled deterministic filters that silently become broad semantic searches.

   Alternative considered: treat unknown filter keys as free text. That is more forgiving for casual text, but it weakens PKQL as an agent-facing contract.

5. Preserve semantic text for embedding search.

   For mixed queries, semantic retrieval should embed only the remaining semantic text after explicit filters are removed. If the query contains filters only, structured retrieval can run without forcing a semantic embedding request.

   Alternative considered: keep embedding the original query. That preserves today's behavior but pollutes semantic similarity with filter syntax such as `company:` and can over-weight exact tokens already handled by structured retrieval.

## Risks / Trade-offs

- Parser rejects existing colon-heavy ad hoc queries -> Mitigation: keep the supported filter list narrow, produce clear errors, and add tests for natural-language queries that do not use PKQL syntax.
- Structured search port changes ripple into infrastructure adapters -> Mitigation: introduce a small filter model and adapt existing `terms` behavior during implementation rather than redesigning ranking.
- Mixed-query semantic text can become empty after parsing -> Mitigation: planner selects `structured` only when no semantic text remains.
- Metadata matching behavior may regress while removing heuristics -> Mitigation: add planner tests proving explicit filters, metadata-backed natural-language terms, and mixed queries still select expected strategies.

## Migration Plan

1. Add PKQL parser, AST, and filter types in the retrieval module.
2. Update planner inputs and outputs to use parsed query intent and expose structured filters/terms needed by existing retrieval code.
3. Adapt `HybridSearch` and `StructuredKnowledgeSearch` to pass filter-aware structured input while preserving current evidence pack output.
4. Replace stopword and generic structured-cue planner heuristics with AST and metadata-backed decisions.
5. Update tests and retrieval documentation for PKQL examples and backward-compatible natural-language behavior.

Rollback is straightforward before release: restore the previous planner contract and keep the parser unused. No persisted data migration is expected.

## Open Questions

- Should date filters accept only ISO-like dates initially, or also year-only values such as `after:2020`?
- Should unknown filter keys always fail, or should the CLI provide an opt-in permissive mode for exploratory human search?
