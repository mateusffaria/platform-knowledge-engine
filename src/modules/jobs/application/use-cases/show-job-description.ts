import { JobDescriptionRepository } from "../ports/job-description-repository.js";

export function createShowJobDescriptionUseCase(repository: JobDescriptionRepository) {
  return {
    async execute(command: { jobDescriptionId: string }) {
      const jobDescription = await repository.findById(command.jobDescriptionId);
      if (!jobDescription) {
        throw new Error(`Job description not found: ${command.jobDescriptionId}`);
      }

      return jobDescription;
    }
  };
}
