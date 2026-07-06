Create the initial Professional Knowledge Engine foundation.

Goal:
Build a local-first CLI application that ingests professional knowledge sources, normalizes them into a canonical career model, stores verified evidence, and prepares the foundation for hybrid retrieval.

Scope:
- TypeScript/Node.js project setup
- CLI skeleton
- Postgres + pgvector setup with Docker Compose
- Drizzle ORM setup
- Initial domain model:
  - SourceDocument
  - KnowledgeAsset
  - EvidenceClaim
  - SourceReference
  - Skill
  - Experience
  - Project
  - Achievement
- Basic ingestion flow for Markdown files only in this first change
- Convert Markdown source into a Canonical Career Document representation
- Store extracted source metadata and raw content
- Add structured logging
- Add OpenTelemetry hooks, but keep exporters minimal/no-op for now
- Add Langfuse abstraction/interface, but do not require real integration yet
- Add README with project purpose and local setup

Out of scope:
- PDF parsing
- DOCX parsing
- LinkedIn parsing
- Resume generation
- Cover letter generation
- Benchmarking LLMs
- Full agent orchestration
- Grafana/VictoriaLogs setup
- Production deployment

Architecture principles:
- Career knowledge store is the source of truth
- Vector search is a retrieval mechanism, not the source of truth
- LLMs must not create unverified career facts
- All generated outputs must be traceable back to EvidenceClaims
- Keep providers replaceable: LLM, embeddings, observability

Expected deliverables:
- Working CLI command: pke ingest ./examples/profile.md
- Database migrations
- Basic tests for the Markdown ingestion pipeline
- Example Markdown source file
- Documentation explaining why Postgres + pgvector was chosen
