import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"

import { evaluationMetricNames, Telemetry } from "../src/shared/observability/tracing.js"
import { OpenTelemetryEvaluationObservability } from "../src/modules/evaluation/infrastructure/observability/open-telemetry-evaluation-observability.js"
import { LangfuseEvaluationObservability } from "../src/modules/evaluation/infrastructure/observability/langfuse-evaluation-observability.js"
import { EvaluationRun } from "../src/modules/evaluation/domain/model.js"

function run(): EvaluationRun {
  const full = { status: "value" as const, value: 1, numerator: 1, denominator: 1 }
  return { reportSchemaVersion: "v1", id: "high-cardinality-run", status: "passed", startedAt: new Date(0), completedAt: new Date(10), versions: { datasetId: "golden", datasetVersion: "1", datasetHash: "hash", gitSha: "sha", provider: "fixture", model: "model", promptVersion: "prompt", candidatePackVersions: ["pack"] }, results: [], qualityMetrics: { evidencePrecisionAtK: full, evidenceRecallAtK: full, requirementCoverageAccuracy: full, missingEvidenceAccuracy: full, unsupportedSelectionRate: full, provenanceCompleteness: full, schemaValidationSuccessRate: full }, performanceMetrics: { averageReasoningLatencyMs: 4, promptTokens: { total: 10, average: 10, samples: 1 }, completionTokens: { total: 5, average: 5, samples: 1 } } }
}

describe("evaluation observability", () => {
  it("emits bounded metric labels and one wide completion event", async () => {
    const metrics: Array<{ name: string; attributes: Record<string, string | undefined> }> = []
    const telemetry: Telemetry = { run: async (_n, _a, operation) => operation(), runWithSpan: async (_n, operation) => operation(), record: () => undefined, count: () => undefined, recordEvaluation: (name, _value, attributes = {}) => metrics.push({ name, attributes }), countEvaluation: (name, attributes = {}) => metrics.push({ name, attributes }), traceId: () => undefined, shutdown: async () => undefined }
    const logger = { info: vi.fn(), error: vi.fn() } as any
    const trace = new OpenTelemetryEvaluationObservability(telemetry, logger).trace({ dataset_version: "1" })
    await trace.stage("scenario-high-cardinality", { stage: "reasoning", metadata: { durationMs: 4, provider: "fixture", model: "model", promptVersion: "prompt" }, observation: { evidence: [], candidateEvidenceIdsByRequirement: {}, coverage: [], schemaValid: true } })
    await trace.assertion("scenario-high-cardinality", { expectationId: "expectation-high-cardinality", stage: "reasoning", type: "schema_validity", passed: true, reasonCode: "expectation_satisfied" })
    await trace.complete(run())
    expect(metrics.length).toBeGreaterThan(5)
    expect(JSON.stringify(metrics)).not.toContain("scenario-high-cardinality")
    expect(JSON.stringify(metrics)).not.toContain("high-cardinality-run")
    expect(logger.info).toHaveBeenCalledOnce()
    expect(JSON.stringify(logger.info.mock.calls[0])).toContain("high-cardinality-run")
  })

  it("attaches safe Langfuse metadata without evidence or prompt content", async () => {
    const events: Array<Record<string, unknown>> = []
    const trace = new LangfuseEvaluationObservability({ trace: () => ({ event: async (name, properties = {}) => { events.push({ name, ...properties }) }, generation: async () => undefined, flush: async () => undefined }) }).trace({ dataset_version: "1" })
    await trace.complete(run())
    const serialized = JSON.stringify(events)
    expect(serialized).toContain("datasetHash")
    expect(serialized).not.toContain("claimText")
    expect(serialized).not.toContain("promptContent")
  })

  it("defines quality and performance metrics separately and provisions dashboard queries", async () => {
    expect(evaluationMetricNames.evidencePrecisionAtK).toContain(".quality.")
    expect(evaluationMetricNames.reasoningLatency).toContain(".performance.")
    const dashboard = await readFile("observability/grafana/dashboards/evaluation-quality.json", "utf8")
    expect(dashboard).toContain("Evidence Precision and Recall at K")
    expect(dashboard).toContain("Reasoning Latency (Performance)")
    expect(() => JSON.parse(dashboard)).not.toThrow()
  })
})
