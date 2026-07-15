import { LangfuseClient } from "../../../../shared/observability/langfuse.js";
import { JobAnalysisObservability, JobAnalysisTrace } from "../../application/ports/job-analysis-observability.js";

export class LangfuseJobAnalysisObservability implements JobAnalysisObservability {
  constructor(private readonly client: LangfuseClient) {}

  trace(name: string, properties?: Record<string, unknown>): JobAnalysisTrace {
    return this.client.trace(name, properties);
  }
}
