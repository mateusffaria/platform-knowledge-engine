# Professional Knowledge Engine

Professional Knowledge Engine is a local-first CLI for turning professional source material into structured, auditable career knowledge and evidence-grounded job-specific resumes. It ingests Markdown, normalizes it into a Canonical Career Document, plans bounded resume content, and deterministically renders Markdown, standalone HTML, or selectable-text PDF artifacts.

The core problem is not resume generation. The core problem is transforming heterogeneous professional sources into verified knowledge that future retrieval and generation workflows can cite.

## Current Scope

- TypeScript/Node.js CLI with a `pke` executable.
- Markdown ingestion through `pke ingest ./examples/profiles/canonical-professional-profile-v1.md`.
- Trusted-knowledge review through `pke claims review`, `pke claims confirm`, and `pke claims reject`.
- Canonical job-description ingestion, deterministic requirement extraction, and LLM-assisted job analysis through `pke jobs`.
- Evidence-grounded Resume Content Planning and deterministic `ats-clean-v1` artifact generation through `pke documents resume`.
- Postgres plus pgvector local infrastructure with Docker Compose.
- Drizzle ORM schema and initial SQL migration.
- Canonical career model covering source documents, knowledge assets, evidence claims, source references, skills, experiences, projects, and achievements.
- Structured logging, OpenTelemetry hooks, and a no-op Langfuse abstraction.

Current exclusions include PDF/DOCX source parsing, DOCX resume output, multiple visual templates, source-resume reproduction, cover letters, LinkedIn/interview generation, universal ATS scoring, automated applications, multi-agent orchestration, hosted deployment, and LLM benchmarking.

## Requirements

- Node.js 22 or newer.
- npm 11 or newer.
- Docker with Docker Compose.
- The pinned Playwright Chromium build for PDF output (`npm run pdf:install`). Markdown and HTML generation do not require a browser.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   npm run pdf:install
   ```

   `pdf:install` is needed only for PDF generation and real PDF integration tests.

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

5. Ingest the canonical example profile:

   ```bash
   npm run pke -- ingest ./examples/profiles/canonical-professional-profile-v1.md
   ```

   Resume generation requires a `professional-profile/v1` Markdown source with explicit `schema` and `language` front matter plus a Candidate `Name`. Existing PDF or DOCX resumes must be manually normalized first; see [Canonical Professional Profile](docs/canonical-professional-profile.md). Generic undeclared Markdown remains supported, but the canonical example is the documented ingestion path.

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

   Ingestion and indexing are separate steps. Run `npm run pke -- index` after ingesting a new or updated profile so semantic search can see the latest persisted knowledge. Indexing is idempotent: unchanged embeddings are skipped. Use `npm run pke -- index --force` to regenerate and update every eligible candidate embedding with the configured provider/model.

   Then index and search verified knowledge:

   ```bash
   npm run pke -- index
   npm run pke -- index --force
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

   Use the `jobDescription.job.id` returned by the ingest JSON output. `analyze` stores a separately validated `JobAnalysis`; it never changes the canonical job description or deterministic requirements. `reason` retrieves preselected canonical evidence, validates a bounded LLM curation, and persists an immutable Curated Evidence Pack. Use `--json` for the complete payload or `--model <model>` to override `LLM_MODEL` for one run. Add `--force` to `jobs analyze`, `jobs reason`, or `documents resume plan` to bypass snapshot reuse and persist a fresh immutable result; on `jobs candidates` and `jobs retrieve`, it refreshes analysis before rebuilding the deterministic result. Existing snapshots are never overwritten.

8. Plan and generate a resume from the persisted Curated Evidence Pack:

   ```bash
   npm run pke -- documents resume plan <job-id> --language en --length standard
   npm run pke -- documents resume generate <job-id> --format pdf --language en --length standard
   ```

   Planning uses the configured LLM. Generation is deterministic and makes no LLM or retrieval call. The default artifact and its neighboring manifest are written under `artifacts/resumes/`.

9. Run tests:

   ```bash
   npm run typecheck
   npm test
   ```

   To run the persisted Postgres/Chromium end-to-end fixture against a migrated local database:

   ```bash
   PKE_DATABASE_INTEGRATION=1 npm test -- --run tests/resume-generation-e2e.test.ts
   ```

## Configuration

Environment variables:

- `DATABASE_URL`: Postgres connection string. Defaults to `postgres://pke:pke@localhost:5432/pke`.
- `LOG_LEVEL`: structured log level. Defaults to `info`.
- `APP_ENV`: deployment environment attached to every log. Defaults to `development`.
- The application version attached to logs and telemetry is read from `package.json`.
- `GIT_SHA`, `DEPLOYMENT_REGION`: optional deployment identifiers attached to logs and OTLP resources.
- `OTEL_ENABLED`: enables optional OpenTelemetry tracing and metrics when set to `true`.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: HTTP OTLP collector endpoint. Defaults to the SDK endpoint when unset; use `http://localhost:4318` for the local stack.
- `OTEL_SERVICE_NAME`: telemetry service name. Defaults to `professional-knowledge-engine`.
- `OTEL_SAMPLE_RATIO`: trace sampling ratio from `0` through `1`. Defaults to `1` for local diagnosis.
- `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`: Langfuse is enabled automatically when both keys are configured; otherwise PKE uses the no-op client.
- `LANGFUSE_CAPTURE_CONTENT`: defaults to `false`; prompts, canonical evidence, and model responses are never sent by the reasoning instrumentation unless a future adapter explicitly opts in to content capture.
- `EMBEDDING_PROVIDER`: embedding provider for semantic retrieval. Use `ollama`.
- `EMBEDDING_MODEL`: embedding model name. Use `nomic-embed-text` for the local Ollama setup; the current vector schema expects 768-dimensional embeddings.
- `LLM_PROVIDER`: text-generation provider for job analysis and evidence reasoning. The current supported value is `ollama`.
- `LLM_MODEL`: required Ollama text-generation model for `pke jobs analyze` and `pke jobs reason`, for example `qwen3:8b`.
- `OLLAMA_BASE_URL`: Ollama API base URL. Defaults to `http://localhost:11434`.
- `SEMANTIC_SEARCH_MIN_SCORE`: optional minimum similarity score for relevant semantic search evidence. Leave unset to preserve unfiltered ranked search behavior.

`EMBEDDING_*` configuration is used for semantic indexing and retrieval. `LLM_*` configuration is used for bounded job analysis, evidence reasoning, and Resume Content Planning. Ingestion, show, deterministic retrieval, and resume generation from an existing compatible plan remain usable without LLM or embedding credentials.

## Resume planning and artifact generation

The end-to-end resume flow is:

```text
Source Resume → Canonical Knowledge → Job Analysis → Candidate Evidence Pack
→ Curated Evidence Pack → Resume Content Plan → ResumeDocument
→ Markdown / HTML / PDF + manifest
```

Candidate presentation metadata comes only from an ingested `professional-profile/v1` source. `Name` is required; Headline, Location, Email, Phone, LinkedIn, GitHub, and Website are optional. Header/contact values are metadata rather than evidence claims, while the rendered resume body remains bounded by the compatible `ResumeContentPlan`.

Create the LLM-backed content plan first, then render it deterministically:

```bash
npm run pke -- documents resume plan <job-id> \
  --language en \
  --length concise

npm run pke -- documents resume generate <job-id> \
  --format pdf \
  --language en \
  --length concise \
  --template ats-clean-v1
```

Generation defaults to `pdf`, `en`, `standard`, and `ats-clean-v1`. Supported formats are `markdown`, `html`, and `pdf`; languages are `en` and `pt-BR`; length profiles are `concise`, `standard`, and `detailed`. Use `--output <matching-extension-path>` to materialize a copy elsewhere, `--json` for exactly one machine-readable result, `--no-progress` to suppress interactive feedback, or `--force` to create a new immutable generation instead of reusing a checksum-valid artifact.

Default artifacts use an identity-suffixed name under `artifacts/resumes/`, with a neighboring `<artifact>.manifest.json`. The manifest preserves the job, analysis, Curated Evidence Pack, Resume Content Plan, renderer/template versions, evidence accounting, candidate-field provenance, requirement/component coverage, known gaps, checksum, and storage metadata. Its renderability checks are not a job-fit or universal ATS score.

If no compatible plan exists, generation stops before rendering and prints the matching planning command. If cached bytes are missing or corrupt, rerun with `--force` to create an immutable successor. See [Deterministic Resume Artifact Generation](docs/resume-artifact-generation.md) for architecture, PDF/CI prerequisites, storage, recovery/rollback, privacy-safe observability, and MVP limitations; see [Evidence-Grounded Resume Content Planning](docs/resume-content-planning.md) for the LLM-backed planning contract.

## Evidence evaluation

Run the versioned golden evidence suite or one scenario:

```bash
npm run pke -- eval list
npm run pke -- eval run
npm run pke -- eval run exact-technology-coverage
npm run pke -- eval show <run-id> --format markdown
```

Evaluation reports retrieval, Candidate Evidence Pack association, and reasoning separately. Deterministic assertions detect expected/forbidden evidence, incorrect missing coverage, unsupported or fabricated selections, provenance gaps, excessive evidence, and invalid schemas. JSON and Markdown export use `--format`; `--output <path>` creates a new file without overwriting an existing report. See [Evidence Evaluation](docs/evaluation.md).

## Terminal progress

Long-running interactive commands (`index`, `search`, `retrieve`, `jobs analyze`, `jobs retrieve`, `jobs candidates`, `jobs reason`, `documents resume plan`, `documents resume generate`, and `eval run`) show transient stage feedback with elapsed time when stderr is a TTY. Resume generation progress covers compatible input loading, reuse checks, deterministic document construction, rendering/inspection, storage, and persistence. This feedback is written directly to the terminal, never through Pino or OpenTelemetry, so it is not exported to Grafana. It is disabled automatically for machine-readable output, redirected output, CI, and non-interactive containers; use `--no-progress` to suppress it explicitly.

## Local reasoning observability

Start the local metrics, logs, and dashboard stack without changing normal CLI operation:

```bash
docker compose --profile observability-lite up -d
OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run pke -- jobs reason <job-id>
```

Grafana is available at `http://localhost:3000` (`admin` / `pke`). Its provisioned **PKE / PKE Reasoning Performance** dashboard shows reasoning latency, tokens, evidence volume, and failures; **PKE Evaluation Quality** separates precision/recall, coverage, missing-evidence, unsupported-selection, provenance, and schema quality from evaluation latency and tokens. PKE emits canonical JSON events with Pino to stderr and, when `OTEL_ENABLED=true`, to the OTLP collector. In **Explore**, select **VictoriaLogs** and run `*`; use `severity:Error` to focus on failures. **Stream filters** intentionally lists only stable stream/resource fields such as `service.name` and `host.name`; per-record application fields such as `event_name`, `error_code`, `error_message`, `error_stack`, and `trace_id` remain queryable but do not appear in that picker. In Code mode, run `* | field_names` to discover every field in the selected time range, then use queries such as `event_name:jobs.reason.command`, `event_name:evaluation.run.completed`, `outcome:failure`, or `trace_id:<trace-id>`. VictoriaMetrics is exposed on port `8428`; VictoriaLogs is exposed on port `9428` for trace-correlated structured logs.

For Langfuse, start `docker compose --profile observability-full up -d`, create local project keys in `http://localhost:3001`, and configure the `LANGFUSE_*` variables above. The default integration sends safe metadata and outcomes only. Retention is seven days in the local Victoria services; adjust the Compose `-retentionPeriod` settings and `OTEL_SAMPLE_RATIO` for longer or lower-volume local investigations. All telemetry integrations are optional; when enabled, PKE does not silently discard instrumentation setup or shutdown failures.

## Job Analysis

Job analysis enriches a persisted canonical job description with conservative inferred requirements; source-aware seniority; canonicalized, source-preserving domain signals; distinct cross-team collaboration and leadership; architecture; and reliability signals. It is not an LLM replacement for deterministic extraction.

```bash
npm run pke -- jobs ingest examples/staff-backend-engineer-job.md --json
npm run pke -- jobs analyze <job-id> --json
npm run pke -- jobs retrieve <job-id> --verbose
npm run pke -- jobs reason <job-id> --verbose
```

The agent receives only the job source and deterministic requirement provenance. It prefers omission over unsupported competency expansion; a source reference or warning never validates an unsupported claim. Successful analyses are immutable snapshots linked to the job, and an identical v3 request (canonical content, prompt version, provider, and model) reuses its existing snapshot unless `--force` requests a fresh immutable identity. Malformed model output is rejected without altering the canonical job or previous analyses. Analysis-derived text can enrich semantic retrieval, but deterministic requirements remain authoritative for PKQL filters and no analysis can modify professional EvidenceClaims.

Evidence reasoning is a separate bounded curation step. It receives only a Candidate Evidence Pack of preselected, claim-addressable canonical evidence and returns a validated Curated Evidence Pack with requirement coverage, selections, rejections, warnings, and limitations. It cannot access repositories, PostgreSQL, pgvector, external search, or tools; it cannot create evidence, rewrite canonical claims or objective signals, or change trust status. Coverage is qualitative (`strong`, `partial`, `weak`, or `missing`) and is not proof that a candidate meets a hiring requirement. Repeated runs with the same candidate-pack hash, selected analysis, provider, model, and prompt version reuse the stored curated result unless `--force` requests a fresh immutable run.

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

The top-level `src/cli/index.ts` remains the executable command registry. The ingest command is registered through the ingestion module, and production infrastructure is wired behind the module boundary so `pke ingest ./examples/profiles/canonical-professional-profile-v1.md` keeps the same user-facing behavior while the ingestion use case remains testable through ports.

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
