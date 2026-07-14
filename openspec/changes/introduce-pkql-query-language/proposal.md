## Why

Retrieval currently depends on heuristic query planning that mixes interpretation, metadata detection, and retrieval strategy selection in one step. As the system becomes more agent-assisted, humans and agents need a deterministic way to express retrieval intent before planning begins.

## What Changes

- Introduce PKQL (Professional Knowledge Query Language) as the canonical query representation for retrieval requests.
- Add a PKQL parser that separates explicit structured filters from remaining semantic text.
- Add a Query AST and search filter model that the retrieval planner consumes instead of raw query text.
- Support initial filters for `company`, `role`, `technology`, `skill`, `project`, `status`, `after`, `before`, and `type`.
- Preserve natural-language and mixed queries by parsing explicit filters while leaving unstructured text available for semantic retrieval.
- Update query planning so metadata matching relies on `KnowledgeMetadataProvider` instead of hardcoded vocabularies or natural-language stopword lists.
- Keep LLM planning, agent orchestration, resume generation, and advanced boolean operators out of scope.

## Capabilities

### New Capabilities
- `pkql-query-language`: Defines PKQL parsing, AST structure, supported filters, mixed-query behavior, and planner integration expectations.

### Modified Capabilities

None.

## Impact

- Affects the retrieval module, especially query planning, retrieval use cases, and CLI search entry points.
- Adds parser and domain/application types for PKQL filters and ASTs.
- Updates planner contracts so downstream retrieval receives parsed query intent.
- May require focused tests for parser behavior, planner input handling, metadata-backed matching, and backward-compatible natural-language search.
