import { Logger, logEvent } from "../../../../shared/logging/logger.js"
import { Telemetry } from "../../../../shared/observability/tracing.js"
import { ResumeGenerationMetric, ResumeGenerationObservability } from "../../application/ports/resume-generation-observability.js"

function stringAttributes(attributes: Record<string, string | number | boolean | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))
}

export class ResumeGenerationObservabilityAdapter implements ResumeGenerationObservability {
  constructor(private readonly telemetry: Telemetry, private readonly logger: Logger) {}

  run<T>(name: string, attributes: Record<string, string | number | boolean | undefined>, operation: () => Promise<T>): Promise<T> {
    return this.telemetry.run(name, attributes as Record<string, string | number | boolean>, operation)
  }

  event(name: string, attributes: Record<string, string | number | boolean | undefined> = {}): void {
    logEvent(this.logger, `documents.resume.generate.${name}`, attributes)
  }

  record(name: ResumeGenerationMetric, value: number, attributes: Record<string, string | number | boolean | undefined> = {}): void {
    this.telemetry.recordResumeGeneration(name, value, stringAttributes(attributes))
  }
}
