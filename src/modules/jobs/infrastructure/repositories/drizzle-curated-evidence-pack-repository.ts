import { and, eq } from "drizzle-orm";

import { normalizeStoredCuratedEvidencePack } from "../../application/curated-evidence-pack-schema.js";
import { CuratedEvidencePackRepository } from "../../application/ports/curated-evidence-pack-repository.js";
import { CuratedEvidencePack } from "../../domain/model.js";
import { curatedEvidencePacks } from "../../../../shared/database/schema.js";

interface CuratedEvidenceDatabase {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
}

function toCuratedEvidencePack(row: typeof curatedEvidencePacks.$inferSelect): CuratedEvidencePack {
  return normalizeStoredCuratedEvidencePack({
    id: row.id,
    runIdentity: row.runIdentity,
    jobDescriptionId: row.jobDescriptionId,
    jobAnalysisId: row.jobAnalysisId ?? undefined,
    candidatePackVersion: row.candidatePackVersion,
    candidatePackHash: row.candidatePackHash,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt
  }, row.curatedEvidence);
}

export class DrizzleCuratedEvidencePackRepository implements CuratedEvidencePackRepository {
  constructor(private readonly db: CuratedEvidenceDatabase) {}

  async save(pack: CuratedEvidencePack): Promise<void> {
    const {
      id,
      runIdentity,
      jobDescriptionId,
      jobAnalysisId,
      candidatePackVersion,
      candidatePackHash,
      provider,
      model,
      promptVersion,
      createdAt,
      ...curatedEvidence
    } = pack;
    await this.db.insert(curatedEvidencePacks).values({
      id,
      runIdentity,
      jobDescriptionId,
      jobAnalysisId,
      candidatePackVersion,
      candidatePackHash,
      provider,
      model,
      promptVersion,
      curatedEvidence,
      createdAt
    });
  }

  async findByRunIdentity(jobDescriptionId: string, runIdentity: string): Promise<CuratedEvidencePack | undefined> {
    const rows = await this.db.select().from(curatedEvidencePacks)
      .where(and(eq(curatedEvidencePacks.jobDescriptionId, jobDescriptionId), eq(curatedEvidencePacks.runIdentity, runIdentity)))
      .limit(1);
    return rows[0] ? toCuratedEvidencePack(rows[0]) : undefined;
  }
}
