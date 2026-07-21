## Context

The jobs module already parses a local job source deterministically, persists a canonical `JobDescription` and `JobRequirement` records, and turns those records into a traceable retrieval intent. This is intentionally independent from the professional knowledge model, hybrid retrieval, and Evidence Pack creation. The codebase also has an Ollama embedding adapter and a Langfuse abstraction, but no text-generation provider boundary.

This change introduces the first bounded LLM workflow: enrichment of an already persisted job description. It must expose useful implicit signals without changing the source-derived job model or allowing an agent to access persistence, retrieval, evidence claims, or Ollama itself.

## Goals / Non-Goals

**Goals:**

- Introduce a provider-agnostic LLM completion port and an Ollama adapter selected at the composition root.
- Produce a separately persisted, schema-validated `JobAnalysis` from a canonical job description.
- Keep explicit deterministic requirements authoritative and make all agent-inferred requirements and signals distinguishable and source-aware.
- Allow the latest valid analysis to enrich the job retrieval intent while preserving traceable Evidence Pack behavior.
- Make prompt version, provider, model, execution outcome, and validation outcome observable through the existing Langfuse boundary.

**Non-Goals:**

- Changing deterministic job ingestion or mutating `JobDescription`, `JobRequirement`, professional knowledge, or `EvidenceClaim` records.
- Tool-using/autonomous agents, multi-agent orchestration, LLM conflict resolution, claim validation, document generation, OpenAI support, or benchmarking.
- Giving the agent direct access to PostgreSQL, pgvector, repositories, retrieval services, or the Ollama HTTP client.

## Decisions

### Keep the agent as a jobs application service behind narrow ports

`JobAnalyzerAgent` will receive an already loaded canonical job description and return a `JobAnalysis` application/domain value. A use case will coordinate loading the job, calling the analyzer, validating and persisting the successful result, and exposing it to retrieval-intent construction. It will depend only on job-facing ports (`JobDescriptionRepository`, `JobAnalysisRepository`, `JobAnalyzer`) and the provider/observability ports.

The agent will only be supplied the raw job source, deterministic requirements, and their source locations. It will not be supplied professional evidence or repository/database handles. This keeps the agent’s responsibility limited to interpreting a job, rather than deciding career truth or retrieving evidence.

Alternative considered: give the CLI or agent direct repository and provider access. This would make tests and architecture-boundary enforcement weaker and violates the project’s hexagonal dependency rules.

### Use a structured `JobAnalysis` snapshot, separate from canonical extraction

A successful run will create an immutable analysis snapshot linked to a job description. The snapshot will store its identifier, job identifier, provider, effective model, prompt version, creation time, structured inferred requirements, categorized signals, ambiguities, and warnings. Inferred requirements will carry an explicit `inferred: true` marker and optional source excerpt/line reference; they will not be inserted into `job_requirements`.

The analysis repository will return the most recent successful analysis for retrieval-intent construction. Re-running analysis therefore preserves prior snapshots while making the newest valid result the active enrichment. If no analysis exists, retrieval continues with the deterministic model exactly as it does today.

Alternative considered: append inferred records to `job_requirements`. That would blur deterministic and agent-produced facts and make reruns, provenance, and failure handling ambiguous.

### Validate at the agent boundary with Zod before persistence

The job-analysis prompt will demand a versioned JSON contract with the required signal categories: inferred requirements, seniority, domain, cross-team leadership, architecture/reliability expectations, ambiguities, and warnings. A Zod schema will parse the provider response into the domain-safe `JobAnalysis` payload, reject unknown/invalid shapes where necessary, require `inferred: true` for agent requirements, and validate source references against the supplied job source when present.

Only a parsed result is persisted. Provider transport failures, missing output, non-JSON output, and schema validation failures return actionable errors and leave both the canonical job and existing analyses unchanged.

Alternative considered: accept free-form Markdown or persist raw provider output. That cannot reliably distinguish inferred facts or protect downstream retrieval from malformed output.

### Put provider configuration and transport in infrastructure

`LlmProvider` will expose structured generation with the system/user prompt, model, and response-format expectation. `OllamaLlmProvider` will implement it through Ollama’s generation endpoint, validate HTTP/JSON transport responses, and have no jobs-domain knowledge. `LlmProviderFactory` will be called by `createProductionJobsServices`, using `LLM_PROVIDER=ollama`, required `LLM_MODEL`, and `OLLAMA_BASE_URL`; `--model` overrides the configured model for a single analysis command.

Alternative considered: reuse the embedding-provider port. Embeddings and text generation have different input/output and failure contracts, so combining them would make both abstractions less clear.

### Enrich retrieval intent explicitly and conservatively

The retrieval-intent use case will load the latest analysis alongside deterministic requirements. It will preserve deterministic ordering/filters as authoritative, add inferred analysis requirements as lower-priority semantic signals, record their analysis/source identifiers, and emit a warning whenever inferred material contributes. No analysis output will alter PKQL filters derived from deterministic canonical requirements unless a future explicit contract permits it.

Alternative considered: allow the agent to construct a final query or Evidence Pack. This would undermine deterministic query planning and evidence traceability.

### Trace the analysis lifecycle through the observability port

The orchestration use case will start a named trace with safe identifiers and record prompt version, provider, model, result success/failure, and validation status. The trace will be flushed in a `finally` path. Prompt source lives in a versioned jobs-agent module rather than inline in a CLI command; trace payloads must avoid unnecessarily duplicating raw job text.

Alternative considered: trace only the HTTP adapter. That would not capture validation and persistence outcomes, which are essential to safely operate the workflow.

## Risks / Trade-offs

- [LLMs infer unsupported expectations] → Mark all analysis-only requirements as inferred, retain source references where available, keep deterministic requirements authoritative, and expose warnings in the retrieval intent.
- [Malformed or changed Ollama response] → Validate transport and Zod schema before persistence; preserve the existing job and prior successful analyses on failure.
- [Prompt/model changes make results hard to compare] → Persist effective model and versioned prompt identifier with every snapshot and trace.
- [Analysis adds irrelevant retrieval terms] → Limit inferred outputs to lower-priority semantic enrichment, retain explicit filters, and surface an inferred-signal warning.
- [Langfuse is disabled or unavailable] → Use the existing no-op observability implementation so analysis behavior remains functional.
- [Database migration affects local installations] → Add an additive migration and retain existing job tables and queries unchanged.

## Migration Plan

1. Add the additive job-analysis persistence tables/schema and generate a Drizzle migration.
2. Deploy code with LLM configuration unset; existing ingestion, show, retrieval, and Evidence Pack flows remain unchanged.
3. Enable analysis only when `LLM_PROVIDER`, `LLM_MODEL`, and Ollama availability are configured; validate with `pke jobs analyze <job-id>`.
4. Roll back application code without destructive database changes. New analysis snapshots can remain unused; canonical job data and deterministic retrieval are unaffected.

## Open Questions

- None for the initial implementation. The analysis contract uses the latest valid snapshot for retrieval and treats model override as a one-run CLI concern; retention policies and alternate providers can be introduced in later changes.
