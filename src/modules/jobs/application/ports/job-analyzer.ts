import { JobAnalysis, JobDescriptionWithRequirements } from "../../domain/model.js";

export interface JobAnalysisRunIdentity {
  analysisIdentity: string;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface JobAnalysisCommand {
  jobDescription: JobDescriptionWithRequirements;
  model?: string;
  regenerationId?: string;
}

export interface JobAnalyzer {
  getRunIdentity(command: JobAnalysisCommand): JobAnalysisRunIdentity;
  analyze(command: JobAnalysisCommand): Promise<JobAnalysis>;
}
