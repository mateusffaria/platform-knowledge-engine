import { Logger, logEvent } from "../../../../shared/logging/logger.js"
import { LangfuseClient } from "../../../../shared/observability/langfuse.js"
import { DocumentMetricAttributes, Telemetry } from "../../../../shared/observability/tracing.js"
import { ResumePlanningMetric, ResumePlanningObservability, ResumePlanningTrace } from "../../application/ports/resume-planning-observability.js"

const metricAttributeKeys = new Set(["provider", "model", "prompt_version", "outcome", "language", "length"])

function metricAttributes(attributes: Record<string, string>): DocumentMetricAttributes {
  return Object.fromEntries(Object.entries(attributes).filter(([key]) => metricAttributeKeys.has(key))) as DocumentMetricAttributes
}

export class ResumePlanningObservabilityAdapter implements ResumePlanningObservability {
  constructor(private readonly telemetry: Telemetry, private readonly langfuse: LangfuseClient, private readonly logger: Logger) {}

  trace(name: string, attributes: Record<string, string | number | boolean | undefined>): ResumePlanningTrace {
    const trace = this.langfuse.trace(name, attributes)
    return {
      event: async (eventName, eventAttributes = {}) => {
        logEvent(this.logger, `documents.resume.plan.${eventName}`, eventAttributes)
        await trace.event(eventName, eventAttributes)
      },
      generation: (input) => trace.generation(input),
      flush: () => trace.flush()
    }
  }

  run<T>(stage: string, attributes: Record<string, string | number | boolean | undefined>, action: () => Promise<T> | T): Promise<T> {
    return this.telemetry.run(`pke.documents.resume.plan.${stage}`, attributes, async () => action())
  }

  record(metric: ResumePlanningMetric, value: number, attributes: Record<string, string>): void {
    this.telemetry.recordDocument(metric, value, metricAttributes(attributes))
  }
}
