## Why

Query planning currently contains metadata traversal and query matching rules that belong outside the planner, making it easy for new professional vocabulary or localized aliases to require planner code changes. Now that PKQL, hybrid retrieval, and the Canonical Career Model are evolving together, planning should depend on parsed query intent, normalized metadata matches, and available retrieval capabilities rather than hardcoded domain knowledge.

## What Changes

- Introduce metadata-driven query planning where `QueryPlanner` consumes a `QueryAst` and normalized `MetadataMatch[]`.
- Add a `MetadataMatcher` application port that resolves persisted professional metadata into normalized match objects before planning.
- Add canonical metadata categories for `skill`, `technology`, `organization`, `role`, `project`, `product`, and `initiative`.
- Add metadata match types for `exact`, `prefix`, `partial`, and `alias`.
- Remove direct planner iteration over `KnowledgeMetadata` groups and remove hardcoded professional-domain vocabulary or language-specific term lists from planner logic.
- Keep semantic retrieval as the default fallback when no explicit filters or metadata matches exist.
- Use structured retrieval when PKQL filters or persisted metadata matches provide structured signals.
- Use both structured and semantic retrieval when structured signals coexist with conceptual free text.
- Preserve explicit PKQL filters as candidate-set constraints for mixed retrieval.
- Add tests proving new technologies, organizations, and roles become discoverable through metadata without planner changes, including English, Portuguese, no-match, and mixed PKQL/free-text queries.
- Update retrieval and PKQL documentation to describe metadata matching ownership and planner inputs.

## Capabilities

### New Capabilities
- `metadata-driven-query-planning`: Defines how retrieval planning uses parsed PKQL, normalized metadata matches, and retrieval capabilities without owning professional vocabulary or language-specific matching heuristics.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/modules/retrieval/application/query-planner.ts`, retrieval application ports, metadata provider/matcher adapters, retrieval types, PKQL integration points, and related tests.
- Affected behavior: planner strategy selection, structured-term derivation, and diagnostics for metadata-backed retrieval.
- Affected docs: retrieval and PKQL documentation describing planner contracts, metadata match categories, match types, and candidate-set constraints.
- Dependencies: no new runtime dependency is expected; matching remains deterministic and based on persisted metadata rather than LLM planning, embedding-based fuzzy matching, query rewriting, or reranking.
