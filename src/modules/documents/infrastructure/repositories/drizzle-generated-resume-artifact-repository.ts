import { desc, eq } from "drizzle-orm"

import { GeneratedResumeArtifactRepository } from "../../application/ports/generated-resume-artifact-repository.js"
import { GeneratedResumeArtifact, ResumeArtifactManifest } from "../../domain/resume-document.js"
import { generatedResumeArtifacts } from "../../../../shared/database/schema.js"

interface GeneratedArtifactDatabase {
  select: (...args: any[]) => any
  insert: (...args: any[]) => any
}

export function hydrateGeneratedResumeArtifact(row: typeof generatedResumeArtifacts.$inferSelect): GeneratedResumeArtifact {
  return {
    id: row.id,
    renderingIdentity: row.renderingIdentity,
    generationIdentity: row.generationIdentity,
    jobDescriptionId: row.jobDescriptionId,
    ...(row.jobAnalysisId ? { jobAnalysisId: row.jobAnalysisId } : {}),
    curatedEvidencePackId: row.curatedEvidencePackId,
    resumeContentPlanId: row.resumeContentPlanId,
    format: row.format as GeneratedResumeArtifact["format"],
    language: row.language as GeneratedResumeArtifact["language"],
    length: row.length as GeneratedResumeArtifact["length"],
    templateId: row.templateId as GeneratedResumeArtifact["templateId"],
    templateVersion: row.templateVersion,
    rendererVersion: row.rendererVersion,
    artifactPath: row.artifactPath,
    manifestPath: row.manifestPath,
    mediaType: row.mediaType,
    checksum: row.checksum,
    byteCount: row.byteCount,
    ...(row.pageCount ? { pageCount: row.pageCount } : {}),
    manifest: row.manifest as unknown as ResumeArtifactManifest,
    createdAt: row.createdAt
  }
}

export class DrizzleGeneratedResumeArtifactRepository implements GeneratedResumeArtifactRepository {
  constructor(private readonly db: GeneratedArtifactDatabase) {}

  async findLatestByRenderingIdentity(renderingIdentity: string): Promise<GeneratedResumeArtifact | undefined> {
    const rows = await this.db.select().from(generatedResumeArtifacts).where(eq(generatedResumeArtifacts.renderingIdentity, renderingIdentity))
      .orderBy(desc(generatedResumeArtifacts.createdAt), desc(generatedResumeArtifacts.id)).limit(1)
    return rows[0] ? hydrateGeneratedResumeArtifact(rows[0]) : undefined
  }

  private async findByGenerationIdentity(generationIdentity: string): Promise<GeneratedResumeArtifact | undefined> {
    const rows = await this.db.select().from(generatedResumeArtifacts).where(eq(generatedResumeArtifacts.generationIdentity, generationIdentity)).limit(1)
    return rows[0] ? hydrateGeneratedResumeArtifact(rows[0]) : undefined
  }

  async save(artifact: GeneratedResumeArtifact): Promise<GeneratedResumeArtifact> {
    const rows = await this.db.insert(generatedResumeArtifacts).values({
      id: artifact.id,
      renderingIdentity: artifact.renderingIdentity,
      generationIdentity: artifact.generationIdentity,
      jobDescriptionId: artifact.jobDescriptionId,
      jobAnalysisId: artifact.jobAnalysisId,
      curatedEvidencePackId: artifact.curatedEvidencePackId,
      resumeContentPlanId: artifact.resumeContentPlanId,
      format: artifact.format,
      language: artifact.language,
      length: artifact.length,
      templateId: artifact.templateId,
      templateVersion: artifact.templateVersion,
      rendererVersion: artifact.rendererVersion,
      artifactPath: artifact.artifactPath,
      manifestPath: artifact.manifestPath,
      mediaType: artifact.mediaType,
      checksum: artifact.checksum,
      byteCount: artifact.byteCount,
      pageCount: artifact.pageCount,
      manifest: artifact.manifest as unknown as Record<string, unknown>,
      createdAt: artifact.createdAt
    }).onConflictDoNothing({ target: generatedResumeArtifacts.generationIdentity }).returning()
    if (rows[0]) return hydrateGeneratedResumeArtifact(rows[0])
    const winner = await this.findByGenerationIdentity(artifact.generationIdentity)
    if (!winner) throw new Error("Generated resume artifact identity conflict occurred without a stored winner.")
    return winner
  }
}
