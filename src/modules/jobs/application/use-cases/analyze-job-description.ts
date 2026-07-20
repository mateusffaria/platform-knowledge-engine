import { randomUUID } from "node:crypto";

import { JobAnalyzer } from "../ports/job-analyzer.js";
import { JobAnalysisRepository } from "../ports/job-analysis-repository.js";
import { JobDescriptionRepository } from "../ports/job-description-repository.js";

export function createAnalyzeJobDescriptionUseCase(dependencies: {
  jobDescriptionRepository: JobDescriptionRepository;
  jobAnalysisRepository: JobAnalysisRepository;
  jobAnalyzer: JobAnalyzer;
}) {
  return {
    async execute(command: { jobDescriptionId: string; model?: string; force?: boolean }) {
      const jobDescription = await dependencies.jobDescriptionRepository.findById(command.jobDescriptionId);
      if (!jobDescription) {
        throw new Error(`Job description not found: ${command.jobDescriptionId}`);
      }
      const analyzerCommand = {
        jobDescription,
        model: command.model,
        ...(command.force ? { regenerationId: randomUUID() } : {})
      };
      const runIdentity = dependencies.jobAnalyzer.getRunIdentity(analyzerCommand);
      if (!command.force) {
        const existing = await dependencies.jobAnalysisRepository.findByAnalysisIdentity(jobDescription.job.id, runIdentity.analysisIdentity);
        if (existing) {
          return existing;
        }
      }
      const analysis = await dependencies.jobAnalyzer.analyze(analyzerCommand);
      try {
        await dependencies.jobAnalysisRepository.save(analysis);
      } catch (error) {
        const concurrentAnalysis = await dependencies.jobAnalysisRepository.findByAnalysisIdentity(jobDescription.job.id, runIdentity.analysisIdentity);
        if (concurrentAnalysis) {
          return concurrentAnalysis;
        }
        throw error;
      }
      return analysis;
    }
  };
}
