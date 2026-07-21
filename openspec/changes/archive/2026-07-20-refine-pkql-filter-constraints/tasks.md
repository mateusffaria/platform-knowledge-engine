## 1. PKQL Semantics

- [x] 1.1 Add AST diagnostics for ambiguous unquoted text filter values while preserving quoted compound values.
- [x] 1.2 Define normalized case-insensitive prefix matching for explicit text filters in structured retrieval.

## 2. Constrained Retrieval

- [x] 2.1 Extend vector search contracts and the PostgreSQL adapter with optional evidence candidate constraints.
- [x] 2.2 Make hybrid retrieval derive constrained candidate identities from explicit structured filters before semantic search.
- [x] 2.3 Preserve unfiltered semantic retrieval for queries without explicit PKQL filters.

## 3. Tests and Documentation

- [x] 3.1 Add parser tests for quoted compound values and ambiguous unquoted compound values.
- [x] 3.2 Add integration tests for partial, quoted, and mixed company filters, including exclusion of unrelated evidence.
- [x] 3.3 Document quoted values, partial matching, ambiguity diagnostics, and constrained mixed retrieval.
- [x] 3.4 Run `npm run typecheck` and `npm test`.
