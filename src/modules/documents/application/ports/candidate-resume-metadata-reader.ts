import { CandidateResumeMetadata } from "../../domain/resume-document.js"
import { ResumeGenerationSource } from "../generation-input.js"

export interface CandidateResumeMetadataReader {
  read(source: ResumeGenerationSource): Promise<CandidateResumeMetadata | undefined>
}
