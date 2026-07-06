Refactor the project architecture to a modular monolith with hexagonal boundaries.

Context:
The current project already has a TypeScript/Node.js CLI, Markdown ingestion, Postgres + pgvector, Drizzle ORM, structured logging, OpenTelemetry hooks, and a no-op Langfuse abstraction.

Goal:
Restructure the codebase around business capabilities instead of technical layers, while preserving the existing behavior.

Architecture:
Use a modular monolith architecture with Hexagonal Architecture / Ports and Adapters inside each module.

The system must be organized by business capability:
- ingestion
- knowledge
- retrieval
- jobs
- documents
- shared

Each module may contain:
- domain
- application/use-cases
- application/ports
- infrastructure
- interfaces/cli

Dependency rules:
- domain must not depend on application, infrastructure, CLI, database, LLMs, telemetry, or external SDKs
- application may depend on domain and ports
- infrastructure implements application ports
- interfaces/cli may call application use cases only
- CLI must never call repositories, database clients, parsers, telemetry clients, or providers directly
- cross-module access must happen through explicit application services or ports, not infrastructure imports

Expected target structure:
src/
  shared/
    config/
    database/
    observability/
    logging/

  modules/
    ingestion/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
        parsers/
        repositories/
      interfaces/
        cli/

    knowledge/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
        repositories/

    retrieval/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
        embeddings/
        vector-store/

    jobs/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
        parsers/

    documents/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
        renderers/

Scope:
- Move existing ingestion logic into the ingestion module
- Move persisted career knowledge concepts into the knowledge module
- Move database setup and shared schema primitives into shared/database where appropriate
- Keep Drizzle migrations working
- Keep the existing CLI command working: pke ingest ./examples/profile.md
- Keep all existing tests passing
- Add or update tests to assert the ingestion use case works through ports
- Update README/docs to document the architecture decision
- Add an ADR explaining why modular monolith + hexagonal architecture was chosen

Out of scope:
- New PDF parser
- New DOCX parser
- LinkedIn parser
- Resume generation
- Full hybrid retrieval implementation
- Real Langfuse integration
- Benchmarking
- HTTP API
- Microservices

Acceptance criteria:
- Existing behavior remains unchanged
- pke ingest ./examples/profile.md still works
- CLI command depends only on application use cases
- Infrastructure adapters implement ports instead of being called directly
- Domain code has no dependency on infrastructure
- Architecture is documented in README or docs/adr
