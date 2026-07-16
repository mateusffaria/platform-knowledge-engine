import { JobAnalysis, JobDescriptionWithRequirements } from "../../domain/model.js";

export interface JobAnalysisRunIdentity {
  analysisIdentity: string;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface JobAnalyzer {
  getRunIdentity(command: { jobDescription: JobDescriptionWithRequirements; model?: string }): JobAnalysisRunIdentity;
  analyze(command: { jobDescription: JobDescriptionWithRequirements; model?: string }): Promise<JobAnalysis>;
}
