import { JobDescriptionRepository } from "../ports/job-description-repository.js";
import { atomicComponentsOf } from "../../domain/atomic-job-requirement.js";

export function createShowJobDescriptionUseCase(repository: JobDescriptionRepository) {
  return {
    async execute(command: { jobDescriptionId: string }) {
      const jobDescription = await repository.findById(command.jobDescriptionId);
      if (!jobDescription) {
        throw new Error(`Job description not found: ${command.jobDescriptionId}`);
      }

      return {
        job: jobDescription.job,
        requirements: jobDescription.requirements.map((requirement) => ({
          ...requirement,
          components: atomicComponentsOf(requirement)
        }))
      };
    }
  };
}
