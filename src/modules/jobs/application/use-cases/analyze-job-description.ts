import { JobAnalyzer } from "../ports/job-analyzer.js";
import { JobAnalysisRepository } from "../ports/job-analysis-repository.js";
import { JobDescriptionRepository } from "../ports/job-description-repository.js";

export function createAnalyzeJobDescriptionUseCase(dependencies: {
  jobDescriptionRepository: JobDescriptionRepository;
  jobAnalysisRepository: JobAnalysisRepository;
  jobAnalyzer: JobAnalyzer;
}) {
  return {
    async execute(command: { jobDescriptionId: string; model?: string }) {
      const jobDescription = await dependencies.jobDescriptionRepository.findById(command.jobDescriptionId);
      if (!jobDescription) {
        throw new Error(`Job description not found: ${command.jobDescriptionId}`);
      }
      const analysis = await dependencies.jobAnalyzer.analyze({ jobDescription, model: command.model });
      await dependencies.jobAnalysisRepository.save(analysis);
      return analysis;
    }
  };
}
