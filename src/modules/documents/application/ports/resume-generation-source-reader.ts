import { ResumeGenerationSource } from "../generation-input.js"

export interface ResumeGenerationSourceReader {
  findById(curatedEvidencePackId: string): Promise<ResumeGenerationSource | undefined>
}
