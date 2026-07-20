import { CompatibleCuratedEvidencePack } from "../planning-input.js"

export interface CompatibleCuratedEvidenceReader {
  findLatestCompatible(jobDescriptionId: string): Promise<CompatibleCuratedEvidencePack | undefined>
}
