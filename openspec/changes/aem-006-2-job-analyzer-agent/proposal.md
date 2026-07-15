## Why

Canonical job descriptions currently preserve only source-derived, deterministic requirements. This makes the retrieval workflow reliable, but cannot surface the implicit seniority, domain, leadership, architecture, and reliability expectations that strongly shape which professional evidence is relevant. A bounded first agentic workflow is needed to enrich a job without weakening source authority or evidence traceability.

## What Changes

- Add a provider-agnostic `LlmProvider` application port, an Ollama implementation, a composition-root factory, and explicit LLM configuration.
- Add a schema-validated `JobAnalyzerAgent` that produces a separately persisted `JobAnalysis` from a canonical job description, with inferred signals, source references where available, and warnings/ambiguities.
- Add `pke jobs analyze <job-id>` with `--model`, `--json`, and `--verbose` options.
- Extend job retrieval-intent construction to safely include agent analysis while retaining deterministic requirements as authoritative and distinguishable.
- Trace agent calls through the existing observability boundary and version prompts.
- Document the workflow and record an ADR for the project’s first agentic workflow.

## Capabilities

### New Capabilities

- `llm-provider`: Provider-independent LLM completion boundary, Ollama configuration, selection, and safe error behavior.
- `job-analysis-agent`: Validated, source-aware agent analysis of persisted canonical job descriptions and its CLI and persistence lifecycle.
- `agent-observability`: Versioned agent prompts and observable agent-inference execution through the observability boundary.

### Modified Capabilities

- None.

## Impact

- Affects the jobs domain, application ports and use cases, CLI composition, Drizzle schema/migrations, shared configuration, and observability integration.
- Adds an Ollama HTTP integration behind an application port and Zod (or equivalent) structured-output validation.
- Extends retrieval-intent inputs while leaving professional EvidenceClaims and Evidence Pack generation unchanged.
- Adds focused tests using mocked LLM responses, plus architecture, jobs, agent-workflow, and ADR documentation.
