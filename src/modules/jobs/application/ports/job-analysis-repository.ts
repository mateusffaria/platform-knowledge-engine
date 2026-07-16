import { JobAnalysis } from "../../domain/model.js";

export interface JobAnalysisRepository {
  save(analysis: JobAnalysis): Promise<void>;
  findLatestByJobDescriptionId(jobDescriptionId: string): Promise<JobAnalysis | undefined>;
  findByAnalysisIdentity(jobDescriptionId: string, analysisIdentity: string): Promise<JobAnalysis | undefined>;
}
