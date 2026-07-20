## ADDED Requirements

### Requirement: Reasoning executions expose correlated OpenTelemetry stages
The system SHALL create a root OpenTelemetry trace for every `jobs reason` execution and child spans for loading the job, loading job analysis, building the candidate evidence pack, canonical hydration, objective scoring, building the LLM payload, Ollama inference, schema validation, and persistence. Traces and structured logs MUST correlate `traceId`, `runIdentity`, `jobDescriptionId`, `jobAnalysisId` when present, and `candidatePackHash` without using those identities as metric labels.

#### Scenario: Successful reasoning contains stage timing
- **WHEN** a `jobs reason` execution completes successfully
- **THEN** its correlated trace contains the root span and a completed child span for every applicable named workflow stage, including independently timed Ollama inference

#### Scenario: Cached result remains observable
- **WHEN** a `jobs reason` execution reuses an equivalent persisted curated pack
- **THEN** the root trace and structured outcome log identify the reuse and omit provider-inference stages that were not executed

### Requirement: Reasoning metrics are bounded and operationally useful
The system SHALL emit metrics for command duration, LLM inference duration, prompt tokens, completion tokens, candidate evidence count, candidate-pack size, evidence sent per requirement, reasoning failures, and schema-validation failures. Metric attributes MUST be limited to bounded operational dimensions, including provider, model, prompt version, outcome, and sanitized failure class; high-cardinality identities and professional-content values MUST NOT be metric attributes.

#### Scenario: LLM response reports usage
- **WHEN** the configured LLM provider returns numeric prompt or completion token usage
- **THEN** the corresponding token metrics are emitted with the execution's bounded provider/model/prompt-version dimensions

#### Scenario: Validation fails
- **WHEN** a provider response fails the reasoning schema or referential validation
- **THEN** the validation-failure metric increments with a sanitized failure classification and the failure does not contain raw response content

### Requirement: Reasoning logs preserve privacy and trace correlation
The system SHALL emit structured stage and outcome logs that include active trace correlation, safe execution identities, provider/model/prompt version, durations, counts, and sanitized error classifications. It MUST NOT emit prompts, canonical evidence text, source excerpts, generated explanations, raw LLM responses, or credentials as ordinary log fields.

#### Scenario: Provider fails
- **WHEN** Ollama inference fails
- **THEN** the failure log and span record the trace correlation, inference stage, and sanitized error classification without recording the prompt or candidate evidence content

### Requirement: Langfuse LLM tracing is optional and content-safe
The system SHALL create a correlated Langfuse trace and generation for an evidence-reasoning LLM call only when Langfuse is enabled and configured. The generation MUST record safe execution metadata, timing, token usage when available, and completion/validation outcomes; prompt, evidence, and completion content MUST remain excluded unless an explicit content-capture setting is enabled.

#### Scenario: Langfuse is disabled
- **WHEN** Langfuse configuration is absent or disabled
- **THEN** reasoning completes with no-op Langfuse behavior while OpenTelemetry and console logging retain their independently configured behavior

#### Scenario: Content capture is not opted in
- **WHEN** Langfuse is enabled and content capture is disabled
- **THEN** the Langfuse generation contains metadata and outcome fields but no prompt, canonical evidence, or generated response content

### Requirement: Observability is fail-open and optional
The system SHALL preserve the existing CLI result and console logging semantics when observability is disabled. Failures in telemetry initialization, metric/log/span export, Langfuse tracing, or shutdown/flush MUST be isolated from the reasoning workflow and reported only through bounded local diagnostics.

#### Scenario: Telemetry exporter is unavailable
- **WHEN** an enabled telemetry exporter cannot be reached during `jobs reason`
- **THEN** the command continues through inference, validation, and persistence according to its normal business behavior

### Requirement: Local observability profiles provide dashboards
The project SHALL provide Docker Compose `observability-lite` and `observability-full` profiles. The lite profile MUST run an OpenTelemetry Collector, VictoriaMetrics, VictoriaLogs, and Grafana; the full profile MUST additionally run Langfuse and its required dependencies. The default profile MUST not require any observability service and MUST NOT run Loki alongside VictoriaLogs.

#### Scenario: Lite profile is started
- **WHEN** a developer starts the lite profile
- **THEN** Grafana has provisioned VictoriaMetrics and VictoriaLogs data sources and a reasoning performance dashboard without manual data-source setup

#### Scenario: Full profile is started
- **WHEN** a developer starts the full profile
- **THEN** the local Langfuse service and its required dependencies are available in addition to all lite-profile services

### Requirement: Reasoning performance dashboard answers latency and failure questions
The provisioned Grafana reasoning performance dashboard SHALL display jobs-reason total duration, Ollama inference duration, prompt and completion tokens, candidate-pack size, candidates per requirement, evidence sent to the reasoner, schema-validation failures, reasoning failures, and latency grouped by model and prompt version.

#### Scenario: Instrumented runs reach local backends
- **WHEN** one or more instrumented reasoning runs are exported to the local stack
- **THEN** the dashboard renders the required duration, volume, failure, and model/prompt-version panels from the emitted telemetry

### Requirement: Local observability operation is documented
The project SHALL document profile startup, application environment configuration, dashboard access, a local reasoning verification flow, privacy/content-capture controls, and configurable sampling and retention. The documentation MUST state that local observability is optional and that telemetry backend failure does not fail the CLI.

#### Scenario: Developer follows local setup guide
- **WHEN** a developer follows the documented lite-stack setup and runs an instrumented `jobs reason` command
- **THEN** they can locate its correlated logs/traces and reasoning dashboard measurements without needing a cloud observability vendor
