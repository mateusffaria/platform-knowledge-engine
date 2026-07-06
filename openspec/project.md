# Professional Knowledge Engine

Professional Knowledge Engine is a local-first system for managing verified professional knowledge and generating job-specific evidence packs and documents.

The core problem is not resume generation. The core problem is transforming heterogeneous professional sources into structured, auditable and retrievable knowledge.

The system must support:
- source ingestion
- canonical career modeling
- evidence validation
- conflict resolution
- hybrid retrieval
- agent-assisted document generation

Architectural thesis:
LLMs should compose outputs from verified evidence, not invent career facts.

Primary stack:
- TypeScript
- Node.js
- Postgres
- pgvector
- Drizzle ORM
- CLI-first interface
- OpenTelemetry
- Langfuse for AI observability

Initial non-goals:
- SaaS product
- multi-user auth
- web dashboard
- production deployment
- automated LLM benchmarking
