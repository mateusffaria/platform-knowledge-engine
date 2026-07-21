import { context, metrics, SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
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

export const evaluationMetricNames = {
  run: "pke.eval.runs",
  stage: "pke.eval.stages",
  assertion: "pke.eval.assertions",
  stageDuration: "pke.eval.stage.duration",
  evidencePrecisionAtK: "pke.eval.quality.evidence_precision_at_k",
  evidenceRecallAtK: "pke.eval.quality.evidence_recall_at_k",
  requirementCoverageAccuracy: "pke.eval.quality.requirement_coverage_accuracy",
  missingEvidenceAccuracy: "pke.eval.quality.missing_evidence_accuracy",
  unsupportedSelectionRate: "pke.eval.quality.unsupported_selection_rate",
  provenanceCompleteness: "pke.eval.quality.provenance_completeness",
  schemaValidationSuccessRate: "pke.eval.quality.schema_validation_success_rate",
  reasoningLatency: "pke.eval.performance.reasoning_latency",
  promptTokens: "pke.eval.performance.prompt_tokens",
  completionTokens: "pke.eval.performance.completion_tokens"
} as const;

export const documentMetricNames = {
  commandDuration: "pke.documents.resume.plan.duration",
  inferenceDuration: "pke.documents.resume.plan.llm.duration",
  promptTokens: "pke.documents.resume.plan.llm.prompt_tokens",
  completionTokens: "pke.documents.resume.plan.llm.completion_tokens",
  validationFailures: "pke.documents.resume.plan.validation_failures",
  cacheHits: "pke.documents.resume.plan.cache_hits"
} as const;

export const resumeGenerationMetricNames = {
  generationDuration: "pke.documents.resume.generate.duration",
  renderingDuration: "pke.documents.resume.generate.render.duration",
  outputSize: "pke.documents.resume.generate.output.bytes",
  pageCount: "pke.documents.resume.generate.pages",
  evidenceCount: "pke.documents.resume.generate.evidence",
  sectionCount: "pke.documents.resume.generate.sections",
  failures: "pke.documents.resume.generate.failures",
  validationFailures: "pke.documents.resume.generate.validation_failures",
  cacheHits: "pke.documents.resume.generate.cache_hits"
} as const;

export type MetricAttributes = Partial<Record<"provider" | "model" | "prompt_version" | "outcome" | "failure_class", string>>;
export type EvaluationMetricAttributes = Partial<Record<"dataset_version" | "stage" | "provider" | "model" | "prompt_version" | "outcome", string>>;
export type DocumentMetricAttributes = Partial<Record<"provider" | "model" | "prompt_version" | "outcome" | "language" | "length", string>>;
export type ResumeGenerationMetricAttributes = Partial<Record<"format" | "language" | "length" | "template_id" | "outcome" | "failure_class", string>>;
export type TraceAttributes = Attributes;

export interface Telemetry {
  run<T>(name: string, attributes: TraceAttributes, operation: () => Promise<T>): Promise<T>;
  runWithSpan<T>(name: string, operation: () => Promise<T>): Promise<T>;
  record(name: keyof typeof reasoningMetricNames, value: number, attributes?: MetricAttributes): void;
  count(name: "failures" | "validationFailures", attributes?: MetricAttributes): void;
  recordEvaluation(name: keyof typeof evaluationMetricNames, value: number, attributes?: EvaluationMetricAttributes): void;
  countEvaluation(name: "run" | "stage" | "assertion", attributes?: EvaluationMetricAttributes): void;
  recordDocument(name: keyof typeof documentMetricNames, value: number, attributes?: DocumentMetricAttributes): void;
  recordResumeGeneration(name: keyof typeof resumeGenerationMetricNames, value: number, attributes?: ResumeGenerationMetricAttributes): void;
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
  recordEvaluation(_name: keyof typeof evaluationMetricNames, _value: number, _attributes?: EvaluationMetricAttributes): void {}
  countEvaluation(_name: "run" | "stage" | "assertion", _attributes?: EvaluationMetricAttributes): void {}
  recordDocument(_name: keyof typeof documentMetricNames, _value: number, _attributes?: DocumentMetricAttributes): void {}
  recordResumeGeneration(_name: keyof typeof resumeGenerationMetricNames, _value: number, _attributes?: ResumeGenerationMetricAttributes): void {}
  traceId(): string | undefined { return undefined; }
  async shutdown(): Promise<void> {}
}

class OTelTelemetry implements Telemetry {
  private readonly meter = metrics.getMeter("professional-knowledge-engine");
  private readonly histograms = new Map<string, ReturnType<typeof this.meter.createHistogram>>();
  private readonly counters = new Map<string, ReturnType<typeof this.meter.createCounter>>();

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
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async runWithSpan<T>(name: string, operation: () => Promise<T>): Promise<T> { return this.run(name, {}, operation); }

  record(name: keyof typeof reasoningMetricNames, value: number, attributes: MetricAttributes = {}): void {
    const metric = reasoningMetricNames[name];
    const histogram = this.histograms.get(metric) ?? this.meter.createHistogram(metric, { unit: name.includes("Duration") ? "ms" : "1" });
    this.histograms.set(metric, histogram);
    histogram.record(value, safeAttributes(attributes));
  }

  count(name: "failures" | "validationFailures", attributes: MetricAttributes = {}): void {
    const metric = reasoningMetricNames[name];
    const counter = this.counters.get(metric) ?? this.meter.createCounter(metric, { unit: "1" });
    this.counters.set(metric, counter);
    counter.add(1, safeAttributes(attributes));
  }

  recordEvaluation(name: keyof typeof evaluationMetricNames, value: number, attributes: EvaluationMetricAttributes = {}): void {
    const metric = evaluationMetricNames[name];
    const histogram = this.histograms.get(metric) ?? this.meter.createHistogram(metric, { unit: name.toLowerCase().includes("duration") || name.toLowerCase().includes("latency") ? "ms" : "1" });
    this.histograms.set(metric, histogram);
    histogram.record(value, safeAttributes(attributes));
  }

  countEvaluation(name: "run" | "stage" | "assertion", attributes: EvaluationMetricAttributes = {}): void {
    const metric = evaluationMetricNames[name];
    const counter = this.counters.get(metric) ?? this.meter.createCounter(metric, { unit: "1" });
    this.counters.set(metric, counter);
    counter.add(1, safeAttributes(attributes));
  }

  recordDocument(name: keyof typeof documentMetricNames, value: number, attributes: DocumentMetricAttributes = {}): void {
    const metric = documentMetricNames[name];
    const instrument = this.histograms.get(metric) ?? this.meter.createHistogram(metric, { unit: name.includes("Duration") ? "ms" : "1" });
    this.histograms.set(metric, instrument);
    instrument.record(value, safeAttributes(attributes));
  }

  recordResumeGeneration(name: keyof typeof resumeGenerationMetricNames, value: number, attributes: ResumeGenerationMetricAttributes = {}): void {
    const metric = resumeGenerationMetricNames[name];
    const instrument = this.histograms.get(metric) ?? this.meter.createHistogram(metric, { unit: name.toLowerCase().includes("duration") ? "ms" : name === "outputSize" ? "By" : "1" });
    this.histograms.set(metric, instrument);
    instrument.record(value, safeAttributes(attributes));
  }

  traceId(): string | undefined { return trace.getActiveSpan()?.spanContext().traceId; }
  async shutdown(): Promise<void> { await this.sdk.shutdown(); }
}

export function createTelemetry(options: boolean | { enabled: boolean; endpoint?: string; serviceName?: string; sampleRatio?: number }): Telemetry {
  const resolved = typeof options === "boolean" ? { enabled: options } : options;
  if (!resolved.enabled) return new NoopTelemetry();
  const endpoint = resolved.endpoint?.replace(/\/$/, "");
  const sdk = new NodeSDK({
    serviceName: resolved.serviceName,
    traceExporter: new OTLPTraceExporter(endpoint ? { url: `${endpoint}/v1/traces` } : undefined),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(resolved.sampleRatio ?? 1) }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(endpoint ? { url: `${endpoint}/v1/metrics` } : undefined),
      exportIntervalMillis: 10_000
    }),
  });
  sdk.start();
  return new OTelTelemetry(sdk);
}

export function activeTraceId(): string | undefined { return trace.getSpan(context.active())?.spanContext().traceId; }
