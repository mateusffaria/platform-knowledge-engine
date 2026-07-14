## Context

The initial PKQL implementation separates filters from semantic text, but text filters require exact canonical values and semantic search runs against the entire vector index. Consequently, `company:acme` does not match `Acme Knowledge Systems`, and a mixed query can return evidence from other organizations.

The structured adapter already materializes professional metadata alongside evidence claims. Vector retrieval stores both evidence-claim and knowledge-asset identities, allowing a constrained structured result set to be passed to semantic search without a database migration.

## Goals / Non-Goals

**Goals:**
- Keep quoted filter values intact as one AST value.
- Make unquoted text filters normalized case-insensitive prefix matches.
- Make every explicit filter constrain candidates for all retrieval strategies.
- Rank semantic results only within the candidates that satisfy explicit filters.
- Preserve no-filter semantic retrieval behavior.
- Give users an actionable warning when unquoted text after a text filter could be part of a compound value.

**Non-Goals:**
- No boolean operators, negation, fuzzy matching, or generalized full-text filtering.
- No metadata validation in the parser.
- No ranking-model changes beyond applying semantic ranking inside an explicit filter constraint.

## Decisions

1. Text filter matching uses normalized prefixes.

   A text filter such as `company:acme` matches a canonical field whose normalized value begins with `acme`, including `Acme Knowledge Systems`. Quoted values use the same matching rule but remain one atomic parser value, preserving compound names. Exact-only matching would keep the current usability problem, while arbitrary substring matching could produce surprising matches.

2. The AST carries parser diagnostics.

   When non-filter text follows an unquoted text filter, the parser emits an advisory diagnostic explaining how to quote a compound value. The query remains valid so `company:acme observability` continues to express a partial company filter plus semantic text. Rejecting it would make ordinary mixed queries impossible; silently accepting it hides a common ambiguity.

3. Explicit filters establish the semantic candidate set.

   Hybrid retrieval runs structured search first for any explicit filter. Its eligible evidence identities are passed to vector search as optional constraints, and vector search applies those constraints in the database before ordering by similarity. Filtering global top-N semantic results afterward could drop valid constrained evidence that ranks below unrelated results.

4. Preserve the unfiltered retrieval path.

   Queries with no PKQL filters retain the current vector-search contract and global semantic ranking. Bare metadata terms continue to select structured retrieval according to the existing planner contract.

## Risks / Trade-offs

- Prefix matching can match multiple similarly named organizations -> The structured filter is intentionally a candidate constraint, and users can quote a fuller value to narrow it.
- Vector constraints expand the shared port -> Both the PostgreSQL adapter and test doubles are updated; no provider or schema change is required.
- Structured filters with no matching candidates yield no semantic search -> This is intentional because semantic retrieval must not escape an explicit constraint.
- Diagnostics may be emitted for intentional mixed queries -> The message is advisory and gives a concrete quoted alternative.

## Migration Plan

1. Add AST diagnostics and prefix-match semantics for text filters.
2. Extend the vector-search port and PostgreSQL adapter with optional evidence identity constraints.
3. Use structured candidates to constrain semantic retrieval whenever explicit PKQL filters are present.
4. Add integration coverage for quoted, partial, and mixed company queries.

Rollback consists of removing the optional vector constraints and restoring exact text matching. No persisted data migration is required.
