export interface JobAnalysisTrace {
  event(name: string, properties?: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}

export interface JobAnalysisObservability {
  trace(name: string, properties?: Record<string, unknown>): JobAnalysisTrace;
}
