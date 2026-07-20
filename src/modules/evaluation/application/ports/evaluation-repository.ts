import { EvaluationRun } from "../../domain/model.js"

export interface EvaluationRepository {
  save(run: EvaluationRun): Promise<void>
  findById(runId: string): Promise<EvaluationRun | undefined>
}
