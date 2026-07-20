import { EvaluationDataset } from "../../domain/model.js"

export interface EvaluationDatasetLoader {
  load(): Promise<EvaluationDataset>
}
