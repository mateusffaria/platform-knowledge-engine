import { EvaluationRepository } from "../ports/evaluation-repository.js"

export function createShowEvaluationRunUseCase(repository: EvaluationRepository) {
  return {
    async execute(runId: string) {
      const run = await repository.findById(runId)
      if (!run) throw new Error(`Evaluation run ${runId} was not found.`)
      return run
    }
  }
}
