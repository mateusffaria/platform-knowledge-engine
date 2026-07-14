## Context

The retrieval module already parses PKQL into a `QueryAst`, selects structured and semantic retrieval strategies, and orchestrates hybrid Evidence Pack generation. The current `QueryPlanner` still owns metadata lookup and matching details: it imports `KnowledgeMetadataProvider`, iterates fixed metadata groups, normalizes free text internally, and derives structured terms by comparing the semantic text to metadata values.

That coupling makes the planner responsible for professional vocabulary shape and language-sensitive matching behavior. It also means model growth, such as `organization`, `product`, and `initiative`, can force planner changes even when retrieval strategy rules are unchanged.

## Goals / Non-Goals

**Goals:**
- Make `QueryPlanner` consume only `QueryAst` and normalized `MetadataMatch[]`.
- Move metadata lookup, normalization, aliases, and category-specific matching into a `MetadataMatcher` application port and its adapter.
- Preserve deterministic strategy selection and Evidence Pack behavior.
- Preserve explicit PKQL filters as candidate-set constraints before semantic ranking.
- Support canonical metadata categories and match types without hardcoding professional vocabulary in planner code.
- Keep retrieval application code behind ports and independent from database, SDK, and knowledge infrastructure imports.

**Non-Goals:**
- LLM-based planning.
- Fuzzy embedding-based metadata matching.
- Query rewriting or reranking.
- Document generation or agent orchestration.
- Changing the `EvidenceClaimStatus` state machine or trusted evidence eligibility policy.

## Decisions

### Keep QueryPlanner Pure

`QueryPlanner.plan` will accept a parsed `QueryAst` and a list of `MetadataMatch` values. It will not fetch metadata, inspect metadata provider structures, normalize vocabulary, or own matching rules. The planner remains responsible only for deterministic strategy selection and plan shaping.

Alternative considered: inject `MetadataMatcher` into `QueryPlanner`. That keeps the public call site small, but it still hides a matching dependency inside planning and weakens the architectural flow from parser to matcher to planner.

### Introduce MetadataMatcher as an Application Port

Add a retrieval application port that accepts the parsed query context and returns normalized metadata matches. The first adapter can use the existing persisted knowledge metadata source, but it should translate provider-specific data into normalized `MetadataMatch` objects before the planner sees it.

`MetadataMatch` should include at least:
- canonical category: `skill`, `technology`, `organization`, `role`, `project`, `product`, or `initiative`;
- canonical value and normalized value;
- match type: `exact`, `prefix`, `partial`, or `alias`;
- matched query text or token span when useful for diagnostics;
- optional alias/source metadata when the adapter can provide it.

Alternative considered: expand `KnowledgeMetadataProvider` and keep matching helpers near the planner. That would reduce new files but would keep category shape and language matching in planner-adjacent code.

### Preserve Existing Structured Retrieval Inputs During Migration

The first implementation can keep `PlannedQuery.structuredTerms` for `StructuredKnowledgeSearch` compatibility while deriving those terms from `MetadataMatch` canonical values instead of raw provider groups. If the structured search port later needs category-aware matching, `metadataMatches` can be added to the planned query or port input without changing strategy selection semantics.

Alternative considered: immediately replace `terms: string[]` with `MetadataMatch[]` in `StructuredKnowledgeSearch`. That is cleaner long term but has a wider blast radius across tests, adapters, and structured search scoring.

### Treat PKQL Filters as Explicit Constraints

Explicit PKQL filters remain structured signals even when no metadata match is found. In mixed queries, structured retrieval establishes the candidate set and semantic retrieval ranks only within that set. Metadata matches can trigger structured retrieval for bare or conceptual text, but they do not override explicit filters.

Alternative considered: use metadata matches as implicit filters for semantic search. That would blur the difference between user-authored PKQL constraints and inferred structured signals, and could unexpectedly narrow conceptual searches.

### Keep Language and Alias Handling Outside Planning

Portuguese and English aliases, localized vocabulary, and category-specific matching rules belong in the metadata matcher adapter or parser layer. The planner sees normalized matches and therefore does not need stopword lists, language lists, or professional-domain dictionaries.

Alternative considered: keep a small list of query terms in the planner for common UX phrases. That conflicts with the goal that persisted metadata and parsing own vocabulary interpretation.

## Risks / Trade-offs

- Metadata match objects may be too thin for future category-aware structured search -> include category, canonical value, normalized value, and match type from the start.
- Keeping `structuredTerms` during migration can preserve string-only matching limitations -> derive it from matches now and leave a clear path to category-aware port inputs.
- Alias matching can over-match short or ambiguous text -> keep deterministic match types and prefer exact/prefix behavior unless aliases are explicitly present in persisted metadata.
- Existing tests may assume `QueryPlanner` owns metadata lookup -> update tests to provide `MetadataMatch[]` directly and add separate matcher tests.
- Documentation may already claim the planner is metadata-driven -> update wording so it names the matcher/planner split accurately.

## Migration Plan

1. Add `MetadataCategory`, `MetadataMatchType`, and `MetadataMatch` retrieval application types.
2. Add a `MetadataMatcher` port and an adapter that uses persisted knowledge metadata to return normalized matches.
3. Refactor `QueryPlanner` to be synchronous or metadata-fetch-free and accept `QueryAst` plus `MetadataMatch[]`.
4. Update `HybridSearch` to parse PKQL, call the matcher, pass matches to the planner, and preserve existing filter and semantic candidate-set behavior.
5. Keep compatibility with `StructuredKnowledgeSearchInput.terms` by deriving terms from metadata matches while preserving explicit PKQL filters.
6. Expand planner, matcher, hybrid retrieval, English/Portuguese, no-match, and mixed PKQL/free-text tests.
7. Update retrieval and PKQL docs.

Rollback is straightforward because this is an application-layer refactor: restore the previous planner/provider wiring and remove the matcher adapter if the new contract causes regressions before release.

## Open Questions

- Should `StructuredKnowledgeSearch` accept category-aware `MetadataMatch[]` in this change, or should that be deferred until structured scoring needs category-specific behavior?
- Where should aliases be persisted for `organization`, `product`, and `initiative` metadata if the current knowledge metadata source does not expose them yet?
