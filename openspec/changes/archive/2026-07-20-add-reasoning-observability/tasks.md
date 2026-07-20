## 1. Observability foundation and configuration

- [x] 1.1 Add the OpenTelemetry SDK/exporter and Langfuse client dependencies required for optional local telemetry.
- [x] 1.2 Extend application configuration with validated OTLP endpoint, service/resource attributes, sampling, Langfuse credentials/endpoint, and explicit Langfuse content-capture settings; retain disabled-by-default behavior.
- [x] 1.3 Replace the generic tracing helper with a fail-open shared telemetry bootstrap that provides no-op and enabled trace, metric, log-correlation, flush, and shutdown adapters.
- [ ] 1.4 Define bounded metric names, histogram units, allowed attributes, and safe error-classification helpers that reject high-cardinality IDs and professional-content fields.
- [ ] 1.5 Extend shared structured logging to attach the active trace context and safe reasoning lifecycle fields while preserving existing console output behavior.
- [ ] 1.6 Implement the configured Langfuse client and generation abstraction with metadata-only defaults, explicit content capture, safe flushing, and failure isolation.

## 2. Reasoning workflow instrumentation

- [ ] 2.1 Add or generalize jobs observability ports/adapters so the reasoning use case, candidate-pack builder, LLM reasoner, validation, and persistence can emit named stages without importing observability backends.
- [ ] 2.2 Instrument `ReasonJobEvidence` with the root command span, correlated execution identities, load-job/load-analysis spans, candidate-pack construction stages, persistence span, cached-result outcome, total-duration metric, and reasoning-failure metric.
- [ ] 2.3 Instrument candidate-pack construction to time canonical hydration and objective scoring, and record candidate count, serialized pack size, and evidence-sent-per-requirement measurements using only bounded metric attributes.
- [ ] 2.4 Instrument LLM payload construction, Ollama inference, schema validation, and finalization in `LlmEvidenceReasoner`, with safe span status/logs and validation-failure measurements on invalid output.
- [x] 2.5 Extend the LLM provider response and Ollama adapter to expose provider token usage when supplied, then emit prompt/completion token metrics and Langfuse generation usage without logging content.
- [x] 2.6 Correlate the Langfuse evidence-reasoning generation with the active OpenTelemetry trace and record provider/model/prompt-version, duration, tokens, and completion/validation outcomes.
- [x] 2.7 Update production jobs composition and lifecycle handling to initialize, flush, and safely close enabled telemetry without changing disabled CLI execution.

## 3. Local observability stack and dashboards

- [x] 3.1 Add OpenTelemetry Collector configuration that receives application OTLP telemetry and exports metrics/logs to VictoriaMetrics and VictoriaLogs with configurable local retention/sampling behavior.
- [x] 3.2 Extend Docker Compose with the opt-in `observability-lite` profile for the Collector, VictoriaMetrics, VictoriaLogs, and Grafana, keeping the existing default and CLI profiles independent of telemetry services.
- [ ] 3.3 Add the `observability-full` profile with Langfuse and all required local dependencies, environment wiring, health checks, and persistent volumes; ensure Loki is absent from the default observability profile.
- [x] 3.4 Provision Grafana VictoriaMetrics and VictoriaLogs data sources plus a versioned reasoning-performance dashboard containing all required duration, token, candidate, evidence, failure, and model/prompt-version panels.

## 4. Verification and documentation

- [ ] 4.1 Add unit tests for no-op and enabled telemetry adapters, safe attributes/log fields, Langfuse content-capture gating, exporter failures, and flush/shutdown failure isolation.
- [ ] 4.2 Add reasoning workflow tests that assert all named stages, trace correlation, bounded metric labels, token usage, cached outcomes, and provider/validation/persistence failure behavior without content leakage.
- [ ] 4.3 Add static or CI-safe checks for Compose profile validity, collector configuration, Grafana provisioning, dashboard panel coverage, and architecture boundaries.
- [x] 4.4 Document local profile startup, environment variables, sampling/retention controls, privacy defaults, dashboard access, and a `jobs reason` end-to-end verification flow.
- [ ] 4.5 Run `npm run typecheck`, `npm test`, Compose configuration validation, and the documented local observability smoke test; record any environment prerequisites or limitations.
