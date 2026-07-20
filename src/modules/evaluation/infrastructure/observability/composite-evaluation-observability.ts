import { EvaluationObservability, EvaluationTrace } from "../../application/ports/evaluation-observability.js"

export class CompositeEvaluationObservability implements EvaluationObservability {
  constructor(private readonly observers: EvaluationObservability[]) {}
  trace(metadata: Record<string, string | undefined>): EvaluationTrace {
    const traces = this.observers.map((observer) => observer.trace(metadata))
    return {
      stage: async (scenarioId, execution) => { await Promise.allSettled(traces.map((trace) => trace.stage(scenarioId, execution))) },
      assertion: async (scenarioId, result) => { await Promise.allSettled(traces.map((trace) => trace.assertion(scenarioId, result))) },
      complete: async (run) => { await Promise.allSettled(traces.map((trace) => trace.complete(run))) },
      flush: async () => { await Promise.allSettled(traces.map((trace) => trace.flush())) }
    }
  }
}
