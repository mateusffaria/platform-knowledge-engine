import { EvaluationDatasetLoader } from "../ports/dataset-loader.js"

export function createListEvaluationScenariosUseCase(loader: EvaluationDatasetLoader) {
  return {
    async execute() {
      const dataset = await loader.load()
      return {
        datasetId: dataset.id,
        datasetVersion: dataset.version,
        datasetHash: dataset.hash,
        scenarios: dataset.scenarios.map(({ id, description }) => ({ id, description }))
      }
    }
  }
}
