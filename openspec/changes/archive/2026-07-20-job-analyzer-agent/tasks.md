## 1. LLM provider foundation

- [x] 1.1 Add `LLM_PROVIDER` and `LLM_MODEL` to shared configuration and `.env.example`, retaining the shared `OLLAMA_BASE_URL` setting.
- [x] 1.2 Add the Zod dependency and define the provider-independent `LlmProvider` application port and structured-generation request/response types.
- [x] 1.3 Implement `OllamaLlmProvider` with configured base URL/model selection and defensive HTTP and JSON response handling.
- [x] 1.4 Implement `LlmProviderFactory` with Ollama selection and actionable errors for missing or unsupported LLM configuration.
- [x] 1.5 Add unit tests for factory selection, model overrides, successful Ollama responses, and provider transport/response failures.

## 2. Job-analysis model and persistence

- [x] 2.1 Define domain models for immutable `JobAnalysis`, inferred requirements/signals, source references, execution metadata, ambiguities, and warnings.
- [x] 2.2 Define `JobAnalysisRepository` and `JobAnalyzer` application ports, including persistence and latest-valid-analysis lookup contracts.
- [x] 2.3 Add additive Drizzle schema for separately persisted analysis snapshots and generate the corresponding migration.
- [x] 2.4 Implement `DrizzleJobAnalysisRepository` to save immutable snapshots and load the latest analysis for a job.
- [x] 2.5 Add repository tests covering snapshot persistence, ordering, and absence of an analysis without altering canonical job requirements.

## 3. Validated Job Analyzer workflow

- [x] 3.1 Create a versioned Job Analyzer prompt module that receives only canonical job source and deterministic requirement provenance.
- [x] 3.2 Implement the Zod structured-output schema for inferred requirements, categorized signals, source references, ambiguities, and warnings.
- [x] 3.3 Implement `JobAnalyzerAgent` to invoke the LLM port, parse and validate output, mark inferred requirements, and reject invalid output before persistence.
- [x] 3.4 Implement the analyze-job use case to load a job, invoke the agent, persist only successful analyses, and preserve prior snapshots on all failures.
- [x] 3.5 Add mocked-provider use-case tests for successful source-aware analysis, missing jobs, non-JSON/invalid outputs, and deterministic-model immutability.

## 4. Observability and composition

- [x] 4.1 Extend the jobs composition root to create the LLM provider, job-analysis repository, analyzer, and analyze-job use case through ports.
- [x] 4.2 Instrument the analysis lifecycle through the Langfuse observability port with safe identifiers, provider, effective model, prompt version, completion, validation, and guaranteed flush behavior.
- [x] 4.3 Add observability tests for successful and failed validation traces and no-op behavior when Langfuse is disabled.
- [x] 4.4 Extend architecture-boundary tests to prevent jobs application/CLI code from importing provider adapters, database clients, retrieval infrastructure, or observability implementations directly.

## 5. Retrieval-intent and CLI integration

- [x] 5.1 Extend retrieval-intent construction to load the latest analysis and add its inferred text as lower-priority semantic enrichment without changing deterministic PKQL filters.
- [x] 5.2 Extend intent provenance and warnings to identify analysis-derived inferred signals while preserving deterministic behavior when no analysis exists.
- [x] 5.3 Add retrieval-intent tests for deterministic-only jobs, analysis-enriched jobs, provenance, deduplication, and traceable Evidence Pack handoff.
- [x] 5.4 Add `pke jobs analyze <job-id>` with `--model`, `--json`, and `--verbose` output behavior through the existing jobs CLI boundary.
- [x] 5.5 Add CLI tests for normal, JSON, verbose, model-override, configuration-failure, and missing-job analysis flows.

## 6. Documentation and verification

- [x] 6.1 Update architecture and jobs documentation with the deterministic-parser → canonical-job → JobAnalyzerAgent → enriched-intent → Evidence Pack flow and boundary constraints.
- [x] 6.2 Update agent-workflow documentation with the Job Analyzer responsibility, structured-output contract, provenance rules, and explicit non-goals.
- [x] 6.3 Add an ADR documenting the first agentic workflow, immutable analysis snapshots, provider port, prompt versioning, and safe failure policy.
- [x] 6.4 Run `npm run db:generate`, review the generated migration, then run `npm run typecheck` and `npm test`.
