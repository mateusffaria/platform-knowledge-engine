import { eq } from "drizzle-orm"

import { ResumeGenerationSourceReader } from "../../application/ports/resume-generation-source-reader.js"
import { ResumeGenerationSource } from "../../application/generation-input.js"
import { curatedEvidencePacks } from "../../../../shared/database/schema.js"
import { hydrateCuratedEvidencePack } from "./drizzle-compatible-curated-evidence-reader.js"

interface GenerationSourceDatabase {
  select: (...args: any[]) => any
}

export class DrizzleResumeGenerationSourceReader implements ResumeGenerationSourceReader {
  constructor(private readonly db: GenerationSourceDatabase) {}

  async findById(curatedEvidencePackId: string): Promise<ResumeGenerationSource | undefined> {
    const rows = await this.db.select().from(curatedEvidencePacks)
      .where(eq(curatedEvidencePacks.id, curatedEvidencePackId)).limit(1)
    if (!rows[0]) return undefined
    let pack
    try { pack = hydrateCuratedEvidencePack(rows[0]) } catch { return undefined }
    const selectedEvidenceIds = [...new Set(pack.recommendedEvidence.map((selection) => selection.evidenceClaimId))].sort()
    const selectedSet = new Set(selectedEvidenceIds)
    return {
      curatedEvidencePack: {
        id: pack.id,
        jobDescriptionId: pack.jobDescriptionId,
        ...(pack.jobAnalysisId ? { jobAnalysisId: pack.jobAnalysisId } : {}),
        requirementCoverage: pack.requirementCoverage.map((requirement) => ({
          requirementId: requirement.requirementId,
          coverageStatus: requirement.coverageStatus,
          selectedEvidenceIds: [...requirement.selectedEvidenceIds].sort(),
          components: (requirement.componentCoverage ?? []).map((component) => ({ componentId: component.componentId, coverageStatus: component.coverageStatus, selectedEvidenceIds: [...component.selectedEvidenceIds].sort() }))
        }))
      },
      selectedEvidenceIds,
      discardedEvidenceIds: [...new Set(pack.discardedEvidence.map((item) => item.evidenceClaimId).filter((id) => !selectedSet.has(id)))].sort(),
      sourceDocumentIds: [...new Set(pack.recommendedEvidence.flatMap((selection) => selection.evidence.sources.map((source) => source.sourceDocumentId)))].sort()
    }
  }
}
