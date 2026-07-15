import { JobAnalysis, JobDescriptionWithRequirements } from "../../domain/model.js";

export interface JobAnalyzer {
  analyze(command: { jobDescription: JobDescriptionWithRequirements; model?: string }): Promise<JobAnalysis>;
}
