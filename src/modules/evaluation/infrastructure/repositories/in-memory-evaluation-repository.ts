import { EvaluationRepository } from "../../application/ports/evaluation-repository.js"
import { EvaluationRun } from "../../domain/model.js"

export class InMemoryEvaluationRepository implements EvaluationRepository {
  private readonly runs = new Map<string, EvaluationRun>()

  async save(run: EvaluationRun): Promise<void> {
    if (this.runs.has(run.id)) throw new Error(`Evaluation run ${run.id} already exists.`)
    this.runs.set(run.id, structuredClone(run))
  }

  async findById(runId: string): Promise<EvaluationRun | undefined> {
    const run = this.runs.get(runId)
    return run ? structuredClone(run) : undefined
  }
}
