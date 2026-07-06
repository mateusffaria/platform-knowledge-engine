## Why

The current codebase is organized primarily by technical layer, which makes it easy for CLI, persistence, parsing, observability, and domain concerns to drift together as the system grows. Refactoring to capability-oriented modules with hexagonal boundaries will preserve today’s CLI behavior while creating clearer extension points for ingestion, knowledge modeling, retrieval, jobs, and document generation.

## What Changes

- Reorganize `src/` into `shared/` infrastructure and `modules/` grouped by business capability.
- Move ingestion parsing and pipeline behavior behind ingestion application use cases and ports.
- Move persisted career knowledge concepts into a knowledge module with domain/application boundaries.
- Move database setup and shared schema primitives into `shared/database` while keeping Drizzle migrations working.
- Ensure CLI handlers call application use cases only, with infrastructure wired at composition boundaries.
- Add focused tests proving ingestion works through ports and preserves existing Markdown ingestion behavior.
- Document the architecture in README or docs, and add an ADR for modular monolith plus hexagonal architecture.

## Capabilities

### New Capabilities
- `modular-monolith-architecture`: Defines module boundaries, allowed dependency directions, CLI composition rules, and architecture documentation requirements for the local-first professional knowledge engine.

### Modified Capabilities

None.

## Impact

- Affected code: `src/cli`, `src/config`, `src/db`, `src/domain`, `src/ingestion`, `src/observability`, and related imports.
- Affected tests: Markdown ingestion tests and new/updated tests around the ingestion use case and ports.
- Affected docs: README and a new ADR under `docs/adr` or the repository’s documented ADR location.
- Runtime behavior should remain unchanged: `pke ingest ./examples/profile.md` must continue to work and Drizzle migrations must remain compatible.
