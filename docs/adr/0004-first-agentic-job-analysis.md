# First Agentic Job Analysis Workflow

## Status

Accepted

## Context

The jobs module deterministically ingests job descriptions and builds traceable retrieval intent. Explicit source requirements are reliable but cannot capture all implicit signals relevant to evidence retrieval, such as seniority, cross-team leadership, or reliability expectations.

The project needs its first agentic workflow without allowing an LLM to alter canonical source data, professional evidence, or retrieval ownership.

## Decision

Introduce `JobAnalyzerAgent` as a bounded jobs application service.

- The agent receives only a persisted canonical job and its deterministic requirement provenance.
- It calls a provider-independent `LlmProvider` port. Initial infrastructure support is `OllamaLlmProvider`, selected by `LlmProviderFactory` using `LLM_PROVIDER`, `LLM_MODEL`, and `OLLAMA_BASE_URL`.
- Its prompt is application-owned and versioned. A Zod schema validates JSON output before it is returned or persisted.
- Each successful run creates an immutable `JobAnalysis` snapshot separate from `JobDescription` and `JobRequirement`, recording provider, model, prompt version, source-aware inferred signals, ambiguities, and warnings.
- Invalid provider output, validation errors, and transport failures persist nothing and leave the canonical job and prior analyses intact.
- Retrieval intent can use the latest valid snapshot only as lower-priority semantic enrichment. Deterministic requirements remain authoritative for PKQL filters.
- The orchestration emits completion and validation events through the observability port and flushes traces on both success and failure.

## Consequences

### Positive

- Adds useful implicit job context without weakening deterministic provenance.
- Keeps Ollama, persistence, and observability adapters outside jobs application code.
- Makes agent behavior traceable by prompt version and model.
- Preserves Evidence Pack and EvidenceClaim boundaries.

### Negative

- Local analysis requires an Ollama model and adds latency.
- Inferred signals can be noisy, so consumers must retain their inferred provenance and warnings.
- Snapshot persistence introduces a migration and lifecycle that future retention policies may need to manage.

## Non-Goals

This decision does not introduce multi-agent orchestration, autonomous tool loops, OpenAI support, LLM conflict resolution, claim validation, resume or cover-letter generation, benchmarking, or automatic applications.
