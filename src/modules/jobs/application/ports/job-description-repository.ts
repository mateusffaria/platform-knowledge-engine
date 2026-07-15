import { JobDescription, JobDescriptionWithRequirements } from "../../domain/model.js";

export interface JobDescriptionRepository {
  hasJobDescriptionVersion(identity: { sourcePath: string; contentHash: string }): Promise<boolean>;
  findByVersion(identity: { sourcePath: string; contentHash: string }): Promise<JobDescriptionWithRequirements | undefined>;
  save(jobDescription: JobDescriptionWithRequirements): Promise<void>;
  findById(jobDescriptionId: string): Promise<JobDescriptionWithRequirements | undefined>;
  list(): Promise<JobDescription[]>;
}
