## Context

The project currently has a working TypeScript/Node.js CLI, Markdown ingestion pipeline, Postgres/pgvector persistence through Drizzle, structured logging, OpenTelemetry hooks, and a no-op Langfuse abstraction. The source tree is still organized mostly by technical layer: CLI code imports config, database clients, persistence adapters, Markdown parsing, observability clients, and ingestion pipeline functions directly.

This layout is sufficient for the current single ingestion flow, but it will become harder to evolve as the system adds retrieval, jobs, document rendering, and agent-assisted workflows. The refactor should preserve behavior while making business capability boundaries explicit and testable.

## Goals / Non-Goals

**Goals:**

- Organize `src/` around business capabilities: `ingestion`, `knowledge`, `retrieval`, `jobs`, `documents`, and `shared`.
- Apply hexagonal architecture inside modules using domain, application use cases, application ports, infrastructure adapters, and CLI interfaces.
- Keep `pke ingest ./examples/profiles/canonical-professional-profile-v1.md` behavior unchanged.
- Keep Drizzle migrations and database schema compatibility intact.
- Make CLI code depend on application use cases rather than parsers, repositories, database clients, telemetry clients, or providers directly.
- Add tests that exercise ingestion through ports.
- Document the architectural decision in README or docs plus an ADR.

**Non-Goals:**

- Add new source parsers such as PDF, DOCX, or LinkedIn.
- Implement hybrid retrieval, resume generation, benchmarking, a real Langfuse integration, an HTTP API, or microservices.
- Redesign the existing persisted data model beyond relocations needed for module boundaries.
- Introduce a dependency injection framework.

## Decisions

### Decision: Use a capability-first modular monolith

The new top-level layout will separate shared technical foundations from business modules:

```text
src/
  shared/
    config/
    database/
    logging/
    observability/
  modules/
    ingestion/
    knowledge/
    retrieval/
    jobs/
    documents/
```

Each module may contain `domain`, `application/use-cases`, `application/ports`, `infrastructure`, and `interfaces/cli` folders as needed. Empty folders should not be created just to match the template; add them when a module has real code.

Alternative considered: keep the current technical folders and add naming conventions. That is less disruptive now, but it does not stop feature work from importing repositories, parsers, and telemetry clients across boundaries.

### Decision: Preserve a CLI composition root while moving command logic into module interfaces

`src/cli/index.ts` should remain the executable entry point and command registry. It should delegate command construction or command action logic to module interface code, such as an ingestion CLI adapter. That module CLI adapter may call ingestion application use cases only; infrastructure construction should happen in an explicit composition layer or factory.

Alternative considered: move all CLI code inside modules immediately. Keeping the top-level executable thin preserves the existing package entry point and reduces risk for the current binary behavior.

### Decision: Model ingestion as an application use case with explicit ports

The ingestion module should expose a use case for ingesting a Markdown source. It should depend on ports such as a source parser/reader and a knowledge persistence port rather than directly importing file parsing or Drizzle persistence. The existing Markdown parser can move into `modules/ingestion/infrastructure/parsers`, while the use case lives under `modules/ingestion/application/use-cases`.

Alternative considered: keep parsing inside the use case because only Markdown exists today. That would preserve short-term simplicity but would weaken the boundary needed for future parsers.

### Decision: Put career knowledge domain and persistence contracts in the knowledge module

Canonical career document types and validation belong to the knowledge domain. The Drizzle implementation that persists those concepts belongs in knowledge infrastructure, while schema/database setup shared by multiple modules belongs under `shared/database`.

Alternative considered: leave `src/domain/model.ts` as a global domain. That is ambiguous as new domains appear; naming it as knowledge makes ownership clearer.

### Decision: Keep Drizzle schema and migrations stable during the move

Move or re-export schema primitives carefully so existing migration files and `drizzle.config.ts` still resolve. The first implementation should prefer compatibility re-exports when useful, then update imports incrementally.

Alternative considered: regenerate migrations after the refactor. That would create avoidable churn and risk changing the database contract despite this being an architecture refactor.

### Decision: Enforce boundaries with tests and import shape first

The implementation should add targeted tests for ingestion through ports and update existing ingestion tests to import from the new module paths. Additional automated import-boundary tooling can be deferred unless the repo already has a suitable lint/test pattern.

Alternative considered: add a full architecture linting tool immediately. That may be useful later, but it is not necessary to complete the current behavior-preserving refactor.

## Risks / Trade-offs

- [Risk] File moves can break ESM import paths or package binary behavior -> Mitigation: move in small slices, run typecheck/tests, and keep compatibility re-exports where they reduce churn.
- [Risk] Drizzle migration tooling may expect current schema locations -> Mitigation: update `drizzle.config.ts` deliberately and verify migration-related scripts still load.
- [Risk] Hexagonal folders can become ceremony if added ahead of behavior -> Mitigation: create only folders containing actual code or near-term ports/use cases required by the refactor.
- [Risk] Cross-module imports may creep back through infrastructure -> Mitigation: document dependency rules and add tests/import checks around the most important CLI and domain boundaries.
- [Risk] Behavior-preserving refactors can hide regressions -> Mitigation: keep the example ingestion test, add port-level tests, and manually verify or test `pke ingest ./examples/profiles/canonical-professional-profile-v1.md`.

## Migration Plan

1. Introduce the `shared/` and `modules/` directories without changing runtime behavior.
2. Move config, database, logging, and observability utilities into `shared/`, updating imports and preserving migration compatibility.
3. Move canonical career model code into `modules/knowledge/domain` and Drizzle persistence into `modules/knowledge/infrastructure/repositories`.
4. Define ingestion application ports and move the ingestion use case into `modules/ingestion/application/use-cases`.
5. Move Markdown parsing into ingestion infrastructure and wire it through the ingestion use case.
6. Thin the CLI entry point so the ingest command calls application use cases through module interface/composition code.
7. Update tests and docs, then run typecheck, tests, and the existing CLI command.

Rollback is straightforward because the refactor should not change persisted data or migrations: restore the previous import layout if tests or CLI verification fail before merging.

## Open Questions

- Should the architecture boundary be enforced by a dedicated import rule tool now, or only documented and covered with focused tests for this change?
- Should compatibility re-exports from old paths be kept temporarily, or should the implementation update all imports in one pass since this is still an early project?
