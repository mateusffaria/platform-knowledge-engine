import { JobDescriptionWithRequirements } from "../../domain/model.js";

export interface JobSourceParser {
  parse(sourcePath: string): Promise<JobDescriptionWithRequirements>;
}
