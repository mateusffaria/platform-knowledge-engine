import path from "node:path";

import { JobDescriptionWithRequirements } from "../../domain/model.js";
import { JobDescriptionRepository } from "../ports/job-description-repository.js";
import { JobSourceParser } from "../ports/job-source-parser.js";

const supportedExtensions = new Set([".md", ".markdown", ".txt"]);

export interface IngestJobDescriptionDependencies {
  parser: JobSourceParser;
  repository: JobDescriptionRepository;
}

export function validateJobSourcePath(sourcePath: string): void {
  if (!supportedExtensions.has(path.extname(sourcePath).toLowerCase())) {
    throw new Error("Only Markdown (.md, .markdown) and plain-text (.txt) job descriptions are supported.");
  }
}

export function createIngestJobDescriptionUseCase({ parser, repository }: IngestJobDescriptionDependencies) {
  return {
    async execute(command: { sourcePath: string }): Promise<{ jobDescription: JobDescriptionWithRequirements; created: boolean }> {
      validateJobSourcePath(command.sourcePath);
      const jobDescription = await parser.parse(command.sourcePath);
      if (jobDescription.job.rawContent.trim().length === 0) {
        throw new Error("Job description content must not be empty.");
      }

      const exists = await repository.hasJobDescriptionVersion({
        sourcePath: jobDescription.job.sourcePath,
        contentHash: jobDescription.job.contentHash
      });
      if (exists) {
        return { jobDescription, created: false };
      }

      await repository.save(jobDescription);
      return { jobDescription, created: true };
    }
  };
}
