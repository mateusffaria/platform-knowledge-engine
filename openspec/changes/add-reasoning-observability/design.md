## Context

`pke jobs reason` currently creates no-op Langfuse traces around provider completion and validation, while the shared OpenTelemetry helper only creates unexported generic spans. The jobs workflow has several independently expensive stages—job/analysis loading, candidate-pack construction, canonical hydration, objective scoring, prompt construction, Ollama inference, output validation, and persistence—but operators cannot separate their latency or correlate their logs. The repository already uses Pino, the OpenTelemetry API, Docker Compose, and optional feature flags; it has no telemetry SDK/exporter, Langfuse SDK, local telemetry backend, or Grafana provisioning.

The design must keep the CLI local-first and usable with no observability configuration. Professional evidence and prompt content are sensitive, while run, job, analysis, and candidate-pack identities are valuable for trace/log correlation but unsuitable as metric labels.

## Goals / Non-Goals

**Goals:**

- Produce correlated traces, metrics, and structured logs for every `jobs reason` execution, including cached-result and failure paths.
- Make total command and Ollama inference duration independently observable, along with bounded token, candidate-pack, and failure metrics.
- Provide reproducible, opt-in local `observability-lite` and `observability-full` Compose profiles with Grafana data sources and a reasoning performance dashboard.
- Send an opt-in Langfuse generation trace for LLM calls while keeping prompt/evidence capture disabled by default.
- Isolate telemetry failures and preserve existing console behavior when integrations are disabled.

**Non-Goals:**

- Production deployment, alerting/paging, cloud telemetry vendors, LLM benchmarking, GPU telemetry, or distributed-service tracing.
- Logging prompt text, raw evidence, provider responses, or other professional content by default.
- Using high-cardinality operational identities as metrics dimensions or changing reasoning, retrieval, validation, or persistence semantics.

## Decisions

### Build a shared, fail-open observability facade on top of OpenTelemetry APIs

Add shared telemetry initialization that configures SDK resource attributes, OTLP exporters, configurable sampling, and process shutdown/flush only when `OTEL_ENABLED` is true. Expose a small shared facade for active spans, counters/histograms, and structured log correlation; jobs application services receive narrow observability ports/adapters and may use OpenTelemetry API types, but never import collectors, VictoriaMetrics, VictoriaLogs, Grafana, or Langfuse SDKs. No-op implementations make disabled telemetry allocation-free from a caller perspective and catch/report exporter failures without failing the command.

The facade establishes a root `pke.jobs.reason` span and nested spans for `load_job`, `load_job_analysis`, `build_candidate_evidence_pack`, `canonical_hydration`, `objective_scoring`, `build_llm_payload`, `ollama_inference`, `schema_validation`, and `persistence`. Each span carries `traceId`, `runIdentity`, `jobDescriptionId`, `jobAnalysisId` when present, and `candidatePackHash` as trace/log attributes; it also carries safe provider/model/prompt-version attributes where available. Errors set span status and record a sanitized error classification rather than prompt/evidence content.

Alternative considered: instrument only the provider adapter. This would hide the upstream candidate-pack and downstream persistence costs that the change must distinguish.

### Define low-cardinality metrics and structured correlation logs

Record histograms for total `jobs reason` command duration and LLM inference duration, counters/histograms for prompt and completion tokens when the provider supplies usage, candidate-evidence count, serialized candidate-pack byte size, and evidence sent per requirement, plus counters for reasoning and schema-validation failures. Metric dimensions are restricted to bounded values such as provider, model, prompt version, outcome, and failure class; `traceId`, `runIdentity`, job/analysis IDs, and candidate-pack hash are never metric labels.

Emit JSON logs at workflow-stage transitions and outcomes through the existing logger. Logs include trace correlation and the requested safe identities, stage, durations, provider/model/prompt version, counts, and sanitized failure class. They exclude prompts, canonical claim/evidence text, source excerpts, generated explanations, raw model responses, and credentials. Console output stays unchanged; structured logs are additionally exportable when telemetry is configured.

Alternative considered: encode all correlation fields in metric labels. It would make metrics unbounded and impair VictoriaMetrics performance.

### Instrument LLM calls with a privacy-gated Langfuse adapter

Replace the current no-op-only Langfuse factory with an optional client configured from local environment values. The evidence-reasoning observability adapter creates a Langfuse trace/generation associated with the OpenTelemetry trace and run identity, records model, prompt version, timing, token usage, completion and validation outcome, and flushes on every terminal path. Prompt, evidence, and generation content remain omitted unless an explicit `LANGFUSE_CAPTURE_CONTENT=true` setting is enabled; the default is metadata-only. Langfuse errors are swallowed after a local warning and cannot change provider, validation, or persistence behavior.

Alternative considered: record full prompts by default for easier debugging. That conflicts with the local professional-data privacy boundary.

### Compose local backends through isolated profiles and provision Grafana

Extend Compose with an `observability-lite` profile containing OpenTelemetry Collector, VictoriaMetrics, VictoriaLogs, and Grafana; it receives OTLP traces/metrics/logs and routes metrics/logs to the Victoria services. `observability-full` additionally starts Langfuse and its required local dependencies, while retaining the lite services. The default and existing `cli` profile start no observability backend; Loki is not included, preventing concurrent default use with VictoriaLogs.

Provision Grafana data sources for VictoriaMetrics and VictoriaLogs and a versioned reasoning-performance dashboard with panels for total duration, Ollama duration, tokens, pack size, candidates and evidence per requirement, validation/reasoning failures, and latency by model/prompt version. Compose volumes and documented backend retention/sampling settings make local data lifecycle explicit and configurable.

Alternative considered: require users to configure arbitrary external backends. It would undermine the repeatable local diagnosis goal.

### Test contracts at the boundaries and document operation

Use mocked telemetry/Langfuse adapters to test span lifecycle, metric dimensions, failure isolation, and privacy filtering. Add focused reasoning-use-case tests to prove all named stages are instrumented and that provider/validation/persistence failures are counted without content leakage. Validate Compose profile configuration and provisioned dashboard JSON/YAML in repository tests or CI-safe static checks. Document environment variables, profile startup commands, dashboard access, a sample `jobs reason` verification flow, and the retention/sampling/privacy defaults.

Alternative considered: test only live Docker services. That would make the suite environment-dependent and would not prove no-op/failure behavior deterministically.

## Risks / Trade-offs

- [Telemetry SDK or backend is unreachable] → Wrap emission/export/flush operations, emit a bounded local warning, and continue the reasoning workflow.
- [High-cardinality identities degrade metrics storage] → Permit them only in traces and structured logs; validate metric attributes against an allowlist.
- [Langfuse capture exposes professional content] → Disable content capture by default, require explicit opt-in, and test redaction paths.
- [Instrumentation changes asynchronous timing or error behavior] → Keep all adapters fail-open and test the same successful/failing use-case results with no-op and throwing adapters.
- [Local stack increases resource use] → Keep it behind profiles, make retention/sampling configurable, and provide a small default retention.
- [Provider lacks token usage] → Emit token metrics only when numeric usage is supplied, preserving duration and outcome telemetry.

## Migration Plan

1. Add additive configuration, SDK/facade/no-op adapters, safe log correlation, and unit tests; defaults leave current CLI behavior unchanged.
2. Instrument the reasoning use case, candidate-pack stages, LLM provider, validation, and persistence; verify failure isolation and bounded metric attributes.
3. Add the real Langfuse adapter with explicit content capture controls and retain the no-op implementation for disabled/misconfigured cases.
4. Add Compose profiles, collector configuration, Grafana provisioning/dashboard assets, and local operating documentation.
5. Run type checking, tests, Compose configuration validation, and a local `jobs reason` smoke flow against the lite/full profiles. Rollback disables the feature flags or removes the additive wiring; no business data migration is required.

## Open Questions

- The exact default sampling ratio and local retention window will be selected during implementation based on the chosen collector and Victoria component image versions; both remain environment-configurable.
