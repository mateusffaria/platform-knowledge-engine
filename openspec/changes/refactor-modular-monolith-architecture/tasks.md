## 1. Establish Target Structure

- [x] 1.1 Create the `src/shared` and `src/modules` directory structure for shared foundations plus ingestion, knowledge, retrieval, jobs, and documents capabilities
- [x] 1.2 Move config, logging, observability, and database client/migration utilities into `src/shared` and update imports
- [x] 1.3 Keep Drizzle schema and migration tooling compatible by updating `drizzle.config.ts`, migration imports, or compatibility exports as needed

## 2. Move Knowledge Capability

- [x] 2.1 Move canonical career document domain types and assertions into `src/modules/knowledge/domain`
- [x] 2.2 Move the Drizzle knowledge persistence adapter into `src/modules/knowledge/infrastructure/repositories`
- [x] 2.3 Define or relocate the knowledge persistence contract so other modules depend on an application port or service contract instead of infrastructure
- [x] 2.4 Update all imports and tests that reference the old domain or persistence paths

## 3. Refactor Ingestion Capability

- [x] 3.1 Move Markdown source validation, reading, and parsing into `src/modules/ingestion/infrastructure/parsers`
- [x] 3.2 Add ingestion application ports for source parsing and knowledge persistence interactions
- [x] 3.3 Move the Markdown ingestion pipeline into an ingestion application use case that depends only on ports and knowledge domain contracts
- [x] 3.4 Wire concrete Markdown parser and knowledge persistence adapters through a composition function for the ingest workflow

## 4. Thin CLI Boundaries

- [x] 4.1 Move ingest command action logic into an ingestion CLI interface module that calls the ingestion application use case
- [x] 4.2 Keep `src/cli/index.ts` as the executable command registry and remove direct command-handler imports of repositories, database clients, parsers, telemetry clients, and providers
- [x] 4.3 Verify `pke ingest ./examples/profile.md` keeps the same user-visible behavior

## 5. Add Tests and Boundary Checks

- [x] 5.1 Update existing Markdown ingestion tests to use the refactored module paths
- [x] 5.2 Add tests for the ingestion use case using recording or in-memory port implementations instead of direct database access
- [x] 5.3 Add lightweight boundary assertions or import-shape tests for domain independence and CLI dependency direction if practical within the existing test setup
- [x] 5.4 Run `npm run typecheck` and `npm test`

## 6. Document the Architecture

- [x] 6.1 Update README or architecture documentation with the modular monolith layout and dependency rules
- [x] 6.2 Add an ADR explaining the modular monolith plus hexagonal architecture decision, alternatives, trade-offs, and non-goals
- [x] 6.3 Review the docs against the OpenSpec requirements and ensure all acceptance criteria are covered
