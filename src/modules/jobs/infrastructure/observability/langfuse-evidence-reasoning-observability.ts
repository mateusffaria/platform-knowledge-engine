import { LangfuseClient } from "../../../../shared/observability/langfuse.js";
import { EvidenceReasoningObservability, EvidenceReasoningTrace } from "../../application/ports/evidence-reasoning-observability.js";

export class LangfuseEvidenceReasoningObservability implements EvidenceReasoningObservability {
  constructor(private readonly client: LangfuseClient) {}

  trace(name: string, properties?: Record<string, unknown>): EvidenceReasoningTrace {
    return this.client.trace(name, properties);
  }
}
