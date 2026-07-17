import { context, metrics, SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";

export const reasoningMetricNames = {
  commandDuration: "pke.jobs.reason.duration",
  inferenceDuration: "pke.jobs.reason.llm.duration",
  promptTokens: "pke.jobs.reason.llm.prompt_tokens",
  completionTokens: "pke.jobs.reason.llm.completion_tokens",
  candidateEvidence: "pke.jobs.reason.candidate_evidence",
  candidatePackBytes: "pke.jobs.reason.candidate_pack.bytes",
  evidencePerRequirement: "pke.jobs.reason.evidence_per_requirement",
  failures: "pke.jobs.reason.failures",
  validationFailures: "pke.jobs.reason.validation_failures"
} as const;

export type MetricAttributes = Partial<Record<"provider" | "model" | "prompt_version" | "outcome" | "failure_class", string>>;
export type TraceAttributes = Attributes;
export type TelemetryLogSeverity = "info" | "error";

export interface Telemetry {
  run<T>(name: string, attributes: TraceAttributes, operation: () => Promise<T>): Promise<T>;
  runWithSpan<T>(name: string, operation: () => Promise<T>): Promise<T>;
  record(name: keyof typeof reasoningMetricNames, value: number, attributes?: MetricAttributes): void;
  count(name: "failures" | "validationFailures", attributes?: MetricAttributes): void;
  log(message: string, attributes?: TraceAttributes, severity?: TelemetryLogSeverity): void;
  traceId(): string | undefined;
  shutdown(): Promise<void>;
}

function safeAttributes(attributes: MetricAttributes = {}): Attributes {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined)) as Attributes;
}

function classify(error: unknown): string {
  if (error instanceof SyntaxError) return "syntax_error";
  if (error instanceof Error && /validat|unknown|invalid/i.test(error.message)) return "validation_error";
  return "operation_error";
}

class NoopTelemetry implements Telemetry {
  async run<T>(_name: string, _attributes: TraceAttributes, operation: () => Promise<T>): Promise<T> { return operation(); }
  async runWithSpan<T>(_name: string, operation: () => Promise<T>): Promise<T> { return operation(); }
  record(_name: keyof typeof reasoningMetricNames, _value: number, _attributes?: MetricAttributes): void {}
  count(_name: "failures" | "validationFailures", _attributes?: MetricAttributes): void {}
  log(_message: string, _attributes?: TraceAttributes, _severity?: TelemetryLogSeverity): void {}
  traceId(): string | undefined { return undefined; }
  async shutdown(): Promise<void> {}
}

class OTelTelemetry implements Telemetry {
  private readonly meter = metrics.getMeter("professional-knowledge-engine");
  private readonly histograms = new Map<string, ReturnType<typeof this.meter.createHistogram>>();
  private readonly counters = new Map<string, ReturnType<typeof this.meter.createCounter>>();
  private readonly logger = logs.getLogger("professional-knowledge-engine");

  constructor(private readonly sdk: NodeSDK) {}

  async run<T>(name: string, attributes: TraceAttributes, operation: () => Promise<T>): Promise<T> {
    const tracer = trace.getTracer("professional-knowledge-engine");
    return tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        return await operation();
      } catch (error) {
        span.recordException(error as Error);
        const failureClass = classify(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: failureClass });
        this.emitLog("telemetry.operation.failed", {
          ...attributes,
          operation: name,
          failure_class: failureClass
        }, "error");
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async runWithSpan<T>(name: string, operation: () => Promise<T>): Promise<T> { return this.run(name, {}, operation); }

  record(name: keyof typeof reasoningMetricNames, value: number, attributes: MetricAttributes = {}): void {
    try {
      const metric = reasoningMetricNames[name];
      const histogram = this.histograms.get(metric) ?? this.meter.createHistogram(metric, { unit: name.includes("Duration") ? "ms" : "1" });
      this.histograms.set(metric, histogram);
      histogram.record(value, safeAttributes(attributes));
    } catch {}
  }

  count(name: "failures" | "validationFailures", attributes: MetricAttributes = {}): void {
    try {
      const metric = reasoningMetricNames[name];
      const counter = this.counters.get(metric) ?? this.meter.createCounter(metric, { unit: "1" });
      this.counters.set(metric, counter);
      counter.add(1, safeAttributes(attributes));
    } catch {}
  }

  log(message: string, attributes: TraceAttributes = {}, severity: TelemetryLogSeverity = "info"): void {
    this.emitLog(message, attributes, severity);
  }

  private emitLog(message: string, attributes: TraceAttributes, severity: TelemetryLogSeverity): void {
    try {
      this.logger.emit({
        severityNumber: severity === "error" ? SeverityNumber.ERROR : SeverityNumber.INFO,
        body: message,
        attributes: { ...attributes, ...(this.traceId() ? { traceId: this.traceId() } : {}) }
      });
    } catch {}
  }

  traceId(): string | undefined { return trace.getActiveSpan()?.spanContext().traceId; }
  async shutdown(): Promise<void> { try { await this.sdk.shutdown(); } catch {} }
}

export function createTelemetry(options: boolean | { enabled: boolean; endpoint?: string; serviceName?: string; sampleRatio?: number }): Telemetry {
  const resolved = typeof options === "boolean" ? { enabled: options } : options;
  if (!resolved.enabled) return new NoopTelemetry();
  try {
    const endpoint = resolved.endpoint?.replace(/\/$/, "");
    const sdk = new NodeSDK({
      serviceName: resolved.serviceName,
      traceExporter: new OTLPTraceExporter(endpoint ? { url: `${endpoint}/v1/traces` } : undefined),
      sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(resolved.sampleRatio ?? 1) }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(endpoint ? { url: `${endpoint}/v1/metrics` } : undefined),
        exportIntervalMillis: 10_000
      }),
      logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter(endpoint ? { url: `${endpoint}/v1/logs` } : undefined) })]
    });
    sdk.start();
    return new OTelTelemetry(sdk);
  } catch {
    return new NoopTelemetry();
  }
}

export function activeTraceId(): string | undefined { return trace.getSpan(context.active())?.spanContext().traceId; }
