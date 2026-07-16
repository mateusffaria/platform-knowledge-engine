export interface EvidenceReasoningTrace {
  event(name: string, properties?: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}

export interface EvidenceReasoningObservability {
  trace(name: string, properties?: Record<string, unknown>): EvidenceReasoningTrace;
}
