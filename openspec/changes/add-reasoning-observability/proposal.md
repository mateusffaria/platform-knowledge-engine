## Why

The evidence-reasoning command calls a local LLM but currently provides too little operational visibility to distinguish input preparation, Ollama inference, validation, and persistence. A local, optional telemetry stack is needed to diagnose slow or failed runs without making observability infrastructure a prerequisite for using the CLI.

## What Changes

- Instrument the `jobs reason` workflow with correlated OpenTelemetry spans, metrics, and structured logs for each material orchestration stage.
- Record safe, low-cardinality operational measurements for command and inference duration, token use, candidate-pack characteristics, evidence selection volume, and failure outcomes.
- Send LLM-generation traces to Langfuse when explicitly enabled, with sensitive prompt and evidence content excluded unless the user opts in.
- Add Docker Compose `observability-lite` and `observability-full` profiles, provisioned Grafana data sources/dashboards, and local operating documentation.
- Preserve existing console logging and ensure disabled or failed telemetry exporters never change reasoning workflow outcomes.

## Capabilities

### New Capabilities

- `reasoning-observability`: Optional, privacy-aware telemetry and local dashboards for the job evidence-reasoning workflow and its LLM calls.

### Modified Capabilities

- None.

## Impact

- Affected code: shared configuration, logging, and telemetry foundations; jobs reasoning orchestration and LLM adapters; CLI composition; and observability-focused tests.
- Affected systems: OpenTelemetry Collector, VictoriaMetrics, VictoriaLogs, Grafana, and optional Langfuse services defined through Docker Compose profiles.
- Dependencies: OpenTelemetry SDK/exporters and Langfuse client integration, with all integrations configured as optional and failure-isolated.
- Documentation: local stack setup, configuration, sampling/retention guidance, privacy controls, and the reasoning performance dashboard.
