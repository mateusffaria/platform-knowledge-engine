import { Telemetry } from "../../../../shared/observability/tracing.js";
import { Logger, logEvent } from "../../../../shared/logging/logger.js";
import { ReasoningWorkflowTelemetry } from "../../application/ports/reasoning-workflow-telemetry.js";

export class OpenTelemetryReasoningWorkflowTelemetry implements ReasoningWorkflowTelemetry {
  constructor(private readonly telemetry: Telemetry, private readonly logger: Logger) {}
  run<T>(stage: string, attributes: Record<string, string | undefined>, operation: () => Promise<T>): Promise<T> {
    return this.telemetry.run(`pke.jobs.reason.${stage}`, Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined)), operation);
  }
  record(name: Parameters<Telemetry["record"]>[0], value: number, attributes: Record<string, string | undefined> = {}): void { this.telemetry.record(name, value, attributes); }
  count(name: "failures" | "validationFailures", attributes: Record<string, string | undefined> = {}): void { this.telemetry.count(name, attributes); }
  event(name: string, attributes: Record<string, string | number | boolean | undefined> = {}, severity: "info" | "error" = "info"): void {
    logEvent(this.logger, name, attributes, severity);
  }
  traceId(): string | undefined { return this.telemetry.traceId(); }
}
