import { EvaluationScenario, EvaluationStageExecution } from "../../domain/model.js"

export interface EvaluationPipeline {
  execute(scenario: EvaluationScenario): Promise<EvaluationStageExecution[]>
}
