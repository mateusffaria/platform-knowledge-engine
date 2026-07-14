## Why

PKQL currently parses compound values only when quoted, but explicit structured filters do not consistently constrain retrieval candidates. This allows a filter such as `company:acme` to miss a canonical organization name and lets mixed search return semantically similar evidence from unrelated organizations.

## What Changes

- Preserve quoted compound PKQL filter values as one structured value.
- Define unquoted text filter values as case-insensitive normalized prefix matches for canonical professional metadata.
- Emit an actionable parser warning when unquoted semantic text immediately follows a text filter and may be intended as part of its value.
- Treat explicit PKQL filters as hard structured candidate constraints.
- Limit mixed-query semantic ranking to candidates that satisfy every explicit filter.
- Preserve pure semantic retrieval behavior when no PKQL filter is present.

## Capabilities

### New Capabilities
- `pkql-filter-constraints`: Defines predictable quoted and partial text filter semantics plus constrained mixed retrieval behavior.

### Modified Capabilities

None.

## Impact

- Affects PKQL AST/parser diagnostics, structured-search filtering, hybrid retrieval orchestration, retrieval documentation, and integration tests.
- Extends structured search contracts so semantic candidates can be constrained by the same typed PKQL filters.
