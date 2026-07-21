## 1. Contracts

- [x] 1.1 Add `MetadataCategory`, `MetadataMatchType`, and `MetadataMatch` retrieval application types.
- [x] 1.2 Add a `MetadataMatcher` application port that returns normalized metadata matches for a parsed query.
- [x] 1.3 Extend or adapt the metadata provider contract so persisted categories include skill, technology, organization, role, project, product, and initiative inputs for matching.
- [x] 1.4 Decide whether `PlannedQuery` carries `metadataMatches` directly or only compatibility `structuredTerms`, and update types accordingly.

## 2. Metadata Matching

- [x] 2.1 Implement deterministic normalization for metadata matching outside `QueryPlanner`.
- [x] 2.2 Implement exact, prefix, partial, and alias match classification in the metadata matcher adapter.
- [x] 2.3 Map legacy provider groups such as `companies` to canonical categories such as `organization`.
- [x] 2.4 Ensure localized aliases can produce the same canonical metadata match for English and Portuguese queries.

## 3. Query Planning

- [x] 3.1 Refactor `QueryPlanner` so `plan` consumes `QueryAst` and `MetadataMatch[]` only.
- [x] 3.2 Remove direct `KnowledgeMetadataProvider` imports, metadata group iteration, and matching helpers from `QueryPlanner`.
- [x] 3.3 Preserve deterministic strategy selection for filter-only, metadata-only, semantic-only, and mixed queries.
- [x] 3.4 Derive structured retrieval input from normalized metadata matches while keeping explicit PKQL filters unchanged.

## 4. Hybrid Retrieval Wiring

- [x] 4.1 Update `HybridSearchDependencies` to accept the metadata matcher or a fully injected query planner path.
- [x] 4.2 Update hybrid retrieval execution to parse PKQL, call metadata matching, and pass matches into the planner.
- [x] 4.3 Preserve explicit PKQL filters as structured candidate-set constraints before semantic ranking.
- [x] 4.4 Preserve filter-only behavior so semantic embedding is skipped when no semantic strategy is selected.

## 5. Tests

- [x] 5.1 Update query planner tests to pass `MetadataMatch[]` directly and verify no metadata provider dependency remains.
- [x] 5.2 Add metadata matcher tests for exact, prefix, partial, alias, and canonical category mapping.
- [x] 5.3 Add tests proving new technologies, organizations, and roles require no planner code changes.
- [x] 5.4 Add English and Portuguese query tests that produce equivalent normalized metadata matches where aliases exist.
- [x] 5.5 Add no-match tests proving semantic retrieval remains the fallback.
- [x] 5.6 Add mixed PKQL/free-text tests proving structured filters and semantic text use both strategies correctly.
- [x] 5.7 Update hybrid retrieval tests to verify explicit filters still constrain semantic candidate sets.

## 6. Documentation and Verification

- [x] 6.1 Update retrieval documentation to describe PKQL parsing, metadata matching, planner inputs, and retrieval strategy selection.
- [x] 6.2 Update PKQL documentation to clarify that explicit filters remain candidate-set constraints alongside metadata matches.
- [x] 6.3 Run `npm run typecheck` and fix any type errors.
- [x] 6.4 Run `npm test` and fix any regressions.
- [x] 6.5 Run `openspec status --change refactor-query-planner-metadata-driven` and confirm the change is apply-ready.
