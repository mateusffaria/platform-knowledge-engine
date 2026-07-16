import { CuratedEvidencePack } from "../../domain/model.js";

export interface CuratedEvidencePackRepository {
  save(pack: CuratedEvidencePack): Promise<void>;
  findByRunIdentity(jobDescriptionId: string, runIdentity: string): Promise<CuratedEvidencePack | undefined>;
}
