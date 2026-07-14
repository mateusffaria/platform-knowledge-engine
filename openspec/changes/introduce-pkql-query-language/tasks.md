## 1. PKQL Model and Parser

- [x] 1.1 Add retrieval query AST types, supported PKQL filter field types, and parsed filter value types.
- [x] 1.2 Implement a PKQL parser that extracts supported `field:value` filters and preserves remaining semantic text.
- [x] 1.3 Support quoted filter values without keeping quote characters in parsed values.
- [x] 1.4 Return clear validation errors for unsupported explicit PKQL filter fields and empty retrieval queries.

## 2. Planner Contract

- [x] 2.1 Update `QueryPlanner` to consume parsed query intent instead of planning from unparsed raw query text.
- [x] 2.2 Remove natural-language stopword and generic structured-cue heuristics from planner strategy selection.
- [x] 2.3 Keep metadata-backed matching through `KnowledgeMetadataProvider` for bare terms that match known companies, roles, technologies, skills, or projects.
- [x] 2.4 Extend planned query output so structured retrieval can receive typed filters and semantic retrieval can receive semantic text separately.

## 3. Retrieval Integration

- [x] 3.1 Parse PKQL at the retrieval boundary before planner strategy selection.
- [x] 3.2 Update `StructuredKnowledgeSearchInput` and its implementations to accept typed PKQL filters while preserving existing structured scoring behavior.
- [x] 3.3 Ensure mixed queries pass parsed filters to structured retrieval and only remaining semantic text to embedding search.
- [x] 3.4 Ensure filter-only queries skip semantic embedding unless semantic text remains.
- [x] 3.5 Surface parser validation errors through the CLI with actionable messages.

## 4. Verification and Documentation

- [x] 4.1 Add parser tests for supported filters, quoted values, mixed queries, natural-language queries, and unsupported filters.
- [x] 4.2 Update planner tests for AST-driven strategy selection, metadata-backed bare-term matching, and removal of stopword-dependent behavior.
- [x] 4.3 Update hybrid retrieval tests for structured-only, semantic-only, mixed PKQL, and filter-only queries.
- [x] 4.4 Document PKQL examples and retrieval behavior in the retrieval README or CLI help.
- [x] 4.5 Run `npm run typecheck` and `npm test`.
