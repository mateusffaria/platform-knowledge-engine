export interface ReasoningWorkflowTelemetry {
  run<T>(stage: string, attributes: Record<string, string | undefined>, operation: () => Promise<T>): Promise<T>;
  record(name: "commandDuration" | "inferenceDuration" | "promptTokens" | "completionTokens" | "candidateEvidence" | "candidatePackBytes" | "evidencePerRequirement", value: number, attributes?: Record<string, string | undefined>): void;
  count(name: "failures" | "validationFailures", attributes?: Record<string, string | undefined>): void;
  event(name: string, attributes?: Record<string, string | number | boolean | undefined>, severity?: "info" | "error"): void;
  traceId(): string | undefined;
}

export class NoopReasoningWorkflowTelemetry implements ReasoningWorkflowTelemetry {
  async run<T>(_stage: string, _attributes: Record<string, string | undefined>, operation: () => Promise<T>): Promise<T> { return operation(); }
  record(_name: "commandDuration" | "inferenceDuration" | "promptTokens" | "completionTokens" | "candidateEvidence" | "candidatePackBytes" | "evidencePerRequirement", _value: number, _attributes?: Record<string, string | undefined>): void {}
  count(_name: "failures" | "validationFailures", _attributes?: Record<string, string | undefined>): void {}
  event(_name: string, _attributes?: Record<string, string | number | boolean | undefined>, _severity?: "info" | "error"): void {}
  traceId(): string | undefined { return undefined; }
}
