export interface EvidenceReasoningTrace {
  event(name: string, properties?: Record<string, unknown>): Promise<void>;
  generation?(properties: { name: string; model?: string; metadata?: Record<string, unknown>; usage?: { promptTokens?: number; completionTokens?: number } }): Promise<void>;
  flush(): Promise<void>;
}

export interface EvidenceReasoningObservability {
  trace(name: string, properties?: Record<string, unknown>): EvidenceReasoningTrace;
}
