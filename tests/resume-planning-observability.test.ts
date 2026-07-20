import { describe, expect, it, vi } from "vitest"

import { ResumePlanningObservabilityAdapter } from "../src/modules/documents/infrastructure/observability/resume-planning-observability-adapter.js"
import { documentMetricNames, Telemetry } from "../src/shared/observability/tracing.js"

describe("resume planning observability", () => {
  it("emits document metrics with bounded labels and content-safe Langfuse metadata", async () => {
    const metrics: Array<{ name: string; attributes: Record<string, string | undefined> }> = []
    const telemetry: Telemetry = {
      run: async (_name, _attributes, operation) => operation(), runWithSpan: async (_name, operation) => operation(),
      record: () => undefined, count: () => undefined, recordEvaluation: () => undefined, countEvaluation: () => undefined,
      recordDocument: (name, _value, attributes = {}) => metrics.push({ name, attributes }), traceId: () => undefined, shutdown: async () => undefined
    }
    const events: unknown[] = []
    const langfuse: any = { trace: (name: string, properties: any) => ({ event: async (eventName: string, eventProperties: any) => events.push({ name, properties, eventName, eventProperties }), generation: async (generation: any) => events.push({ generation }), flush: async () => undefined }) }
    const logger = { info: vi.fn(), error: vi.fn() } as any
    const adapter = new ResumePlanningObservabilityAdapter(telemetry, langfuse, logger)
    adapter.record("commandDuration", 10, { provider: "ollama", model: "qwen", prompt_version: "v1", language: "en", length: "standard", outcome: "success", planIdentity: "high-cardinality-plan", jobDescriptionId: "high-cardinality-job" })
    const trace = adapter.trace("resume-content-planning", { jobDescriptionId: "job-id", language: "en", length: "standard" })
    await trace.event("planning_succeeded", { planId: "plan-id" })
    await trace.generation?.({ name: "resume_content_generation", model: "qwen", metadata: { provider: "ollama", promptVersion: "v1" }, usage: { promptTokens: 10 } })
    expect(documentMetricNames.commandDuration).toContain("pke.documents.resume.plan")
    expect(JSON.stringify(metrics)).not.toContain("high-cardinality")
    expect(JSON.stringify(events)).not.toContain("claimText")
    expect(JSON.stringify(events)).not.toContain("systemPrompt")
    expect(JSON.stringify(events)).not.toContain("provider response")
  })
})
