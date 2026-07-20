import { EvaluationAssertionResult, EvaluationRun, EvaluationStageExecution } from "../../domain/model.js"

export interface EvaluationTrace {
  stage(scenarioId: string, execution: EvaluationStageExecution): Promise<void>
  assertion(scenarioId: string, result: EvaluationAssertionResult): Promise<void>
  complete(run: EvaluationRun): Promise<void>
  flush(): Promise<void>
}

export interface EvaluationObservability {
  trace(metadata: Record<string, string | undefined>): EvaluationTrace
}

export class NoopEvaluationTrace implements EvaluationTrace {
  async stage(): Promise<void> {}
  async assertion(): Promise<void> {}
  async complete(): Promise<void> {}
  async flush(): Promise<void> {}
}

export class NoopEvaluationObservability implements EvaluationObservability {
  trace(): EvaluationTrace { return new NoopEvaluationTrace() }
}
