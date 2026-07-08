# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript/Node.js local-first CLI for professional knowledge ingestion and retrieval. Runtime code lives in `src/`. The executable entry point is `src/cli/index.ts`.

Use the modular monolith layout under `src/modules/`: `ingestion`, `knowledge`, `retrieval`, `documents`, and `jobs`. Each module follows hexagonal boundaries where applicable: `domain`, `application/ports`, `application/use-cases`, `infrastructure`, and `interfaces/cli`. Shared foundations belong in `src/shared/` for config, database, logging, and observability.

Tests live in `tests/`. Database schema is in `src/shared/database/schema.ts`, migrations in `drizzle/`, examples in `examples/`, architecture docs in `docs/`, and OpenSpec planning artifacts in `openspec/`.

## Build, Test, and Development Commands

- `npm run dev` or `npm run pke -- <command>`: run the CLI via `tsx`.
- `npm run build`: compile TypeScript to `dist/`.
- `npm run typecheck`: run TypeScript without emitting files.
- `npm test`: run the Vitest suite.
- `npm run db:generate`: generate Drizzle migrations.
- `npm run db:migrate`: build and apply SQL migrations.
- `npm run db:studio`: open Drizzle Studio.

Example: `npm run pke -- ingest examples/profile.md`.

## Coding Style & Naming Conventions

Use ESM TypeScript with explicit `.js` import suffixes for local runtime imports. Prefer named exports. Keep domain code free of infrastructure, database, SDK, telemetry, and CLI dependencies. Use kebab-case for folders and OpenSpec change names, PascalCase for classes/types, and camelCase for functions and variables. The existing code uses two-space indentation and semicolons are omitted.

## Testing Guidelines

Vitest is the test framework. Name tests `*.test.ts` and place them under `tests/`. Add focused tests for use cases, ports, deterministic transformations, and architecture boundaries. Run `npm run typecheck` and `npm test` before committing.

## Commit & Pull Request Guidelines

Use semantic commit messages, matching current history: `feat: ...`, `fix: ...`, `refactor: ...`. Keep commits focused and include OpenSpec artifacts when implementing a planned change.

Pull requests should describe the change, list verification commands run, link the relevant OpenSpec change or issue, and mention any migration/configuration impact.

## Security & Configuration Tips

Do not commit secrets. Copy `.env.example` to `.env` locally and configure `DATABASE_URL` and provider credentials there. Retrieval commands may require embedding-provider configuration; ingestion must remain usable without embedding credentials.
