# Professional Knowledge Engine

Professional Knowledge Engine is a local-first CLI for turning professional source material into structured, auditable career knowledge. The first supported workflow ingests Markdown, normalizes it into a Canonical Career Document, and stores raw source content plus evidence-backed career records in Postgres.

The core problem is not resume generation. The core problem is transforming heterogeneous professional sources into verified knowledge that future retrieval and generation workflows can cite.

## Current Scope

- TypeScript/Node.js CLI with a `pke` executable.
- Markdown ingestion through `pke ingest ./examples/profile.md`.
- Trusted-knowledge review through `pke claims review`, `pke claims confirm`, and `pke claims reject`.
- Canonical job-description ingestion, deterministic requirement extraction, and LLM-assisted job analysis through `pke jobs`.
- Postgres plus pgvector local infrastructure with Docker Compose.
- Drizzle ORM schema and initial SQL migration.
- Canonical career model covering source documents, knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements.
- Structured logging, OpenTelemetry hooks, and a no-op Langfuse abstraction.

Out of scope for this foundation: PDF parsing, DOCX parsing, LinkedIn ingestion, resume generation, cover letter generation, multi-agent orchestration, hosted deployment, and LLM benchmarking.

## Requirements

- Node.js 22 or newer.
- npm 11 or newer.
- Docker with Docker Compose.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Start Postgres with pgvector and Ollama:

   ```bash
   docker compose up -d postgres ollama
   docker compose run --rm ollama-pull
   ```

   `ollama-pull` downloads `nomic-embed-text` into the `pke-ollama-data` Docker volume. You only need to rerun it after changing models or recreating that volume.

   The supplied Compose configuration reserves all available NVIDIA GPUs for the `ollama` service. Install and configure the NVIDIA Container Toolkit before starting it on an NVIDIA host. On a CPU-only host, remove the `ollama.deploy.resources.reservations.devices` block before running Compose.

4. Apply migrations:

   ```bash
   npm run db:migrate
   ```

   The initial SQL migration is also available under `drizzle/`.

5. Ingest the example profile:

   ```bash
   npm run pke -- ingest ./examples/profile.md
   ```

6. Optional: enable semantic retrieval, job analysis, and evidence reasoning with Ollama.

   Install and start Ollama, then pull the local embedding model:

   ```bash
   ollama pull nomic-embed-text
   ```

   Configure these values in `.env`:

   ```bash
   EMBEDDING_PROVIDER=ollama
   EMBEDDING_MODEL=nomic-embed-text
   LLM_PROVIDER=ollama
   LLM_MODEL=qwen3:8b
   OLLAMA_BASE_URL=http://localhost:11434
   ```

   Pull the Job Analyzer model when using the Compose-managed Ollama service:

   ```bash
   docker compose exec ollama ollama pull qwen3:8b
   ```

   The current embedding table is configured for 768-dimensional vectors, which matches `nomic-embed-text`. Models that return a different vector size will be rejected before indexing or search because pgvector columns cannot mix embedding dimensions.

   Ingestion and indexing are separate steps. Run `npm run pke -- index` after ingesting a new or updated profile so semantic search can see the latest persisted knowledge. Indexing is idempotent: unchanged embeddings are skipped.

   Then index and search verified knowledge:

   ```bash
   npm run pke -- index
   npm run pke -- search "retrieval systems"
   npm run pke -- search "retrieval systems" --min-score 0.7 --limit 5
   ```

   You can also run the built CLI image through Docker Compose:

   ```bash
   docker compose run --rm pke-migrate
   docker compose run --rm pke index
   docker compose run --rm pke search "retrieval systems"
   ```

7. Analyze a job description with the configured LLM:

   ```bash
   npm run pke -- jobs ingest examples/staff-backend-engineer-job.md --json
   npm run pke -- jobs analyze <job-id> --verbose
   npm run pke -- jobs retrieve <job-id> --verbose
   npm run pke -- jobs reason <job-id> --verbose
   ```

   Use the `jobDescription.job.id` returned by the ingest JSON output. `analyze` stores a separately validated `JobAnalysis`; it never changes the canonical job description or deterministic requirements. `reason` retrieves preselected canonical evidence, validates a bounded LLM curation, and persists an immutable Curated Evidence Pack. Use `--json` for the complete payload or `--model <model>` to override `LLM_MODEL` for one run.

8. Run tests:

   ```bash
   npm test
   ```

## Configuration

Environment variables:

- `DATABASE_URL`: Postgres connection string. Defaults to `postgres://pke:pke@localhost:5432/pke`.
- `LOG_LEVEL`: structured log level. Defaults to `info`.
- `OTEL_ENABLED`: enables OpenTelemetry span creation when set to `true`.
- `LANGFUSE_ENABLED`: reserved for future real Langfuse integration. The current implementation remains no-op without credentials.
- `EMBEDDING_PROVIDER`: embedding provider for semantic retrieval. Use `ollama`.
- `EMBEDDING_MODEL`: embedding model name. Use `nomic-embed-text` for the local Ollama setup; the current vector schema expects 768-dimensional embeddings.
- `LLM_PROVIDER`: text-generation provider for job analysis and evidence reasoning. The current supported value is `ollama`.
- `LLM_MODEL`: required Ollama text-generation model for `pke jobs analyze` and `pke jobs reason`, for example `qwen3:8b`.
- `OLLAMA_BASE_URL`: Ollama API base URL. Defaults to `http://localhost:11434`.
- `SEMANTIC_SEARCH_MIN_SCORE`: optional minimum similarity score for relevant semantic search evidence. Leave unset to preserve unfiltered ranked search behavior.

`EMBEDDING_*` configuration is used for semantic indexing and retrieval. `LLM_*` configuration is used for bounded job analysis and evidence reasoning; ingestion, show, and deterministic retrieval remain usable without LLM configuration.

## Job Analysis

Job analysis enriches a persisted canonical job description with conservative inferred requirements; source-aware seniority; canonicalized, source-preserving domain signals; distinct cross-team collaboration and leadership; architecture; and reliability signals. It is not an LLM replacement for deterministic extraction.

```bash
npm run pke -- jobs ingest examples/staff-backend-engineer-job.md --json
npm run pke -- jobs analyze <job-id> --json
npm run pke -- jobs retrieve <job-id> --verbose
npm run pke -- jobs reason <job-id> --verbose
```

The agent receives only the job source and deterministic requirement provenance. It prefers omission over unsupported competency expansion; a source reference or warning never validates an unsupported claim. Successful analyses are immutable snapshots linked to the job, and an identical v3 request (canonical content, prompt version, provider, and model) reuses its existing snapshot. Malformed model output is rejected without altering the canonical job or previous analyses. Analysis-derived text can enrich semantic retrieval, but deterministic requirements remain authoritative for PKQL filters and no analysis can modify professional EvidenceClaims.

Evidence reasoning is a separate bounded curation step. It receives only a Candidate Evidence Pack of preselected, claim-addressable canonical evidence and returns a validated Curated Evidence Pack with requirement coverage, selections, rejections, warnings, and limitations. It cannot access repositories, PostgreSQL, pgvector, external search, or tools; it cannot create evidence, rewrite canonical claims or objective signals, or change trust status. Coverage is qualitative (`strong`, `partial`, `weak`, or `missing`) and is not proof that a candidate meets a hiring requirement. Repeated runs with the same candidate-pack hash, selected analysis, provider, model, and prompt version reuse the stored curated result.

## Semantic Search Relevance

Semantic search uses pgvector cosine distance through the `<=>` operator. The CLI reports `similarityScore`, calculated as:

```text
similarityScore = 1 - cosineDistance
```

The vector store returns ranked similarity matches only; it does not decide whether a match is relevant. Relevance filtering is handled by the search use case with either `--min-score <number>` or `SEMANTIC_SEARCH_MIN_SCORE`. When no threshold is configured, search returns the same ranked results as before.

Default output is compact. Use `--verbose` for identifiers and full embedding text, or `--json` for machine-readable output:

```bash
npm run pke -- search "retrieval systems" --verbose
npm run pke -- search "retrieval systems" --json
```

Claim status controls semantic indexing eligibility. `confirmed` and `single_source` claims are searchable by default; `needs_review`, `rejected`, and `superseded` claims are excluded. See [Trusted Knowledge](docs/trusted-knowledge.md) for the full policy.

## Architecture

The project is a modular monolith with hexagonal boundaries inside each business capability. Source code is organized into shared foundations and capability modules:

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

`shared/` contains technical foundations that can be used by multiple modules, such as configuration, database setup, logging, and observability. `modules/` contains business capabilities. A module can contain:

- `domain`: pure business types and invariants.
- `application/use-cases`: orchestration of business workflows.
- `application/ports`: contracts for persistence, parsing, rendering, providers, or other external effects.
- `infrastructure`: adapters that implement ports with Drizzle, the filesystem, parsers, providers, or SDKs.
- `interfaces/cli`: command adapters that translate CLI input into application calls.

Dependency rules:

- Domain code must not depend on application, infrastructure, CLI, database clients, LLMs, telemetry, or external SDKs.
- Application code may depend on domain code and ports.
- Infrastructure implements application ports.
- CLI command handlers call application-facing contracts only; they do not call repositories, database clients, parsers, telemetry clients, or providers directly.
- Cross-module collaboration happens through explicit application services or ports, not infrastructure imports.

The top-level `src/cli/index.ts` remains the executable command registry. The ingest command is registered through the ingestion module, and production infrastructure is wired behind the module boundary so `pke ingest ./examples/profile.md` keeps the same user-facing behavior while the ingestion use case remains testable through ports.

## Why Postgres + pgvector

Postgres is the career knowledge store and source of truth. It holds raw sources, canonical career records, evidence claims, and source references in relational tables where integrity and traceability can be enforced.

pgvector is included now because future hybrid retrieval will need vector search near the relational knowledge model. Vector search is a retrieval mechanism, not the source of truth. LLMs and embeddings must not create or authorize unverified career facts; generated outputs should trace back to persisted evidence claims.

## Ubiquitous Language

- **Source Document**: An ingested professional source such as a Markdown profile. It stores source type, path, metadata, raw content, and ingestion time.
- **Canonical Career Document**: The normalized representation produced from a source document before persistence.
- **Knowledge Asset**: A persisted, versionable unit of normalized career knowledge derived from a source document.
- **Evidence Claim**: A concrete claim extracted from source material, such as a skill, project, or achievement statement.
- **Source Reference**: The link from an evidence claim back to the source document section or location that supports it.
- **Skill**: A professional capability extracted from evidence.
- **Experience**: A role or work history entry extracted from evidence.
- **Project**: A named body of work extracted from evidence.
- **Achievement**: A result, outcome, or accomplishment extracted from evidence.
- **Hybrid Retrieval**: Future retrieval that combines relational filters, lexical search, and vector similarity.
- **Provider Boundary**: An interface that keeps replaceable services such as observability, embeddings, and LLMs from leaking into domain logic.

## Supported Markdown Shape

The deterministic parser supports frontmatter plus these top-level sections:

- `## Summary`
- `## Skills`
- `## Experience`
- `## Projects`
- `## Achievements`

Items should be written as bullet points. The parser preserves raw Markdown even when a future change needs richer extraction.
