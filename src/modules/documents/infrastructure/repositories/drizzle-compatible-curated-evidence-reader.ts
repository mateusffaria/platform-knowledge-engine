import { desc, eq, inArray, or } from "drizzle-orm"

import { CompatibleCuratedEvidenceReader } from "../../application/ports/compatible-curated-evidence-reader.js"
import { CompatibleCuratedEvidencePack, ResumePlanningEvidence } from "../../application/planning-input.js"
import { normalizeStoredCuratedEvidencePack } from "../../../jobs/application/curated-evidence-pack-schema.js"
import { CuratedEvidencePack } from "../../../jobs/domain/model.js"
import { curatedEvidencePacks, experiences, projects, skills } from "../../../../shared/database/schema.js"

interface DocumentsInputDatabase {
  select: (...args: any[]) => any
}

export interface SelectedPresentationRows {
  experiences: Array<typeof experiences.$inferSelect>
  projects: Array<typeof projects.$inferSelect>
  skills: Array<typeof skills.$inferSelect>
}

function metricTokens(...values: Array<string | undefined>): string[] {
  const expression = /(?:[$€£R$]\s?\d[\d.,]*|\d+(?:[.,]\d+)?\s?(?:%|x|ms|s|seconds?|segundos?|hours?|horas?|days?|dias?|users?|usuários?|requests?|requisições?))/giu
  return [...new Set(values.flatMap((value) => value ? [...value.matchAll(expression)].map((match) => match[0].trim()) : []))].sort()
}

export function mapCompatibleCuratedEvidencePack(pack: CuratedEvidencePack, rows: SelectedPresentationRows): CompatibleCuratedEvidencePack {
  const experienceByEvidence = new Map(rows.experiences.map((row) => [row.evidenceClaimId, row]))
  const projectByEvidence = new Map(rows.projects.map((row) => [row.evidenceClaimId, row]))
  const skillByEvidence = new Map(rows.skills.map((row) => [row.evidenceClaimId, row]))
  const experienceByAsset = new Map(rows.experiences.map((row) => [row.knowledgeAssetId, row]))
  const projectByAsset = new Map(rows.projects.map((row) => [row.knowledgeAssetId, row]))
  const skillByAsset = new Map(rows.skills.map((row) => [row.knowledgeAssetId, row]))
  const requirementIdsByEvidence = new Map<string, Set<string>>()
  const componentIdsByEvidence = new Map<string, Set<string>>()
  for (const requirement of pack.requirementCoverage) {
    for (const evidenceId of requirement.selectedEvidenceIds) {
      const ids = requirementIdsByEvidence.get(evidenceId) ?? new Set<string>()
      ids.add(requirement.requirementId)
      requirementIdsByEvidence.set(evidenceId, ids)
    }
    for (const component of requirement.componentCoverage ?? []) {
      for (const evidenceId of component.selectedEvidenceIds) {
        const ids = componentIdsByEvidence.get(evidenceId) ?? new Set<string>()
        ids.add(component.componentId)
        componentIdsByEvidence.set(evidenceId, ids)
      }
    }
  }

  const selectedEvidence: ResumePlanningEvidence[] = pack.recommendedEvidence.map((selection) => {
    const evidence = selection.evidence
    const candidateAssetIds = [evidence.subjectAssetId, evidence.knowledgeAssetId, evidence.relatedAssetId].filter((value): value is string => value !== undefined)
    const experience = experienceByEvidence.get(selection.evidenceClaimId) ?? candidateAssetIds.map((id) => experienceByAsset.get(id)).find((row) => row !== undefined)
    const project = projectByEvidence.get(selection.evidenceClaimId) ?? candidateAssetIds.map((id) => projectByAsset.get(id)).find((row) => row !== undefined)
    const skill = skillByEvidence.get(selection.evidenceClaimId) ?? candidateAssetIds.map((id) => skillByAsset.get(id)).find((row) => row !== undefined)
    const technologies = [...new Set([...(project?.technologies ?? []), ...(skill?.name ? [skill.name] : [])])].sort()
    return {
      evidenceClaimId: selection.evidenceClaimId,
      knowledgeAssetId: evidence.knowledgeAssetId,
      subjectAssetId: evidence.subjectAssetId,
      subjectType: evidence.subjectType,
      claimType: evidence.claimType,
      claimCategory: evidence.claimCategory,
      predicate: evidence.predicate,
      claimText: evidence.claimText,
      valueText: evidence.valueText,
      valueUnit: evidence.valueUnit,
      claimStatus: evidence.claimStatus,
      contribution: selection.contribution,
      exaggerationRisk: selection.exaggerationRisk,
      requirementIds: [...(requirementIdsByEvidence.get(selection.evidenceClaimId) ?? [])].sort(),
      componentIds: [...(componentIdsByEvidence.get(selection.evidenceClaimId) ?? selection.addressedComponentIds ?? [])].sort(),
      presentation: {
        sourceOrganizationOrExperienceId: evidence.subjectAssetId ?? experience?.knowledgeAssetId ?? project?.knowledgeAssetId ?? skill?.knowledgeAssetId ?? evidence.knowledgeAssetId,
        organization: experience?.organization ?? undefined,
        role: experience?.role ?? undefined,
        startDate: experience?.startDate ?? undefined,
        endDate: experience?.endDate ?? undefined,
        technologies,
        metrics: metricTokens(evidence.claimText, evidence.valueText, evidence.valueUnit)
      },
      provenance: evidence.sources.map((source) => ({ sourceDocumentId: source.sourceDocumentId, sourceReferenceId: source.sourceReferenceId, locator: source.locator }))
    }
  }).sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId))
  const globallySelectedIds = new Set(selectedEvidence.map((evidence) => evidence.evidenceClaimId))

  return {
    id: pack.id,
    jobDescriptionId: pack.jobDescriptionId,
    createdAt: pack.createdAt,
    provider: pack.provider,
    model: pack.model,
    promptVersion: pack.promptVersion,
    requirements: pack.requirementCoverage.map((requirement) => ({
      requirementId: requirement.requirementId,
      requirementText: requirement.requirementText,
      importance: requirement.importance,
      coverageStatus: requirement.coverageStatus,
      selectedEvidenceIds: [...requirement.selectedEvidenceIds].sort(),
      components: (requirement.componentCoverage ?? []).map((component) => ({
        componentId: component.componentId,
        componentIndex: component.componentIndex ?? 0,
        componentText: component.componentText,
        coverageStatus: component.coverageStatus,
        selectedEvidenceIds: [...component.selectedEvidenceIds].sort()
      })).sort((left, right) => left.componentIndex - right.componentIndex || left.componentId.localeCompare(right.componentId))
    })).sort((left, right) => left.requirementId.localeCompare(right.requirementId)),
    selectedEvidence,
    discardedEvidenceIds: [...new Set(pack.discardedEvidence.map((evidence) => evidence.evidenceClaimId).filter((evidenceId) => !globallySelectedIds.has(evidenceId)))].sort(),
    missingRequirementIds: [...new Set([
      ...pack.missingEvidence.map((missing) => missing.requirementId),
      ...pack.requirementCoverage.filter((requirement) => requirement.coverageStatus === "missing").map((requirement) => requirement.requirementId)
    ])].sort(),
    missingComponentIds: [...new Set(pack.requirementCoverage.flatMap((requirement) => (requirement.componentCoverage ?? [])
      .filter((component) => component.coverageStatus === "missing" || component.selectedEvidenceIds.length === 0)
      .map((component) => component.componentId)))].sort(),
    warnings: [...pack.warnings],
    limitations: [...pack.limitations]
  }
}

function toPack(row: typeof curatedEvidencePacks.$inferSelect): CuratedEvidencePack {
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
  }, row.curatedEvidence)
}

export class DrizzleCompatibleCuratedEvidenceReader implements CompatibleCuratedEvidenceReader {
  constructor(private readonly db: DocumentsInputDatabase) {}

  async findLatestCompatible(jobDescriptionId: string): Promise<CompatibleCuratedEvidencePack | undefined> {
    const storedRows = await this.db.select().from(curatedEvidencePacks)
      .where(eq(curatedEvidencePacks.jobDescriptionId, jobDescriptionId))
      .orderBy(desc(curatedEvidencePacks.createdAt), desc(curatedEvidencePacks.id))
    let pack: CuratedEvidencePack | undefined
    for (const row of storedRows) {
      try { pack = toPack(row); break } catch { continue }
    }
    if (!pack) return undefined
    const evidenceIds = [...new Set(pack.recommendedEvidence.map((selection) => selection.evidenceClaimId))]
    const assetIds = [...new Set(pack.recommendedEvidence.flatMap((selection) => [selection.evidence.knowledgeAssetId, selection.evidence.subjectAssetId, selection.evidence.relatedAssetId].filter((value): value is string => value !== undefined)))]
    if (evidenceIds.length === 0) return mapCompatibleCuratedEvidencePack(pack, { experiences: [], projects: [], skills: [] })
    const [experienceRows, projectRows, skillRows] = await Promise.all([
      this.db.select().from(experiences).where(or(inArray(experiences.evidenceClaimId, evidenceIds), inArray(experiences.knowledgeAssetId, assetIds))),
      this.db.select().from(projects).where(or(inArray(projects.evidenceClaimId, evidenceIds), inArray(projects.knowledgeAssetId, assetIds))),
      this.db.select().from(skills).where(or(inArray(skills.evidenceClaimId, evidenceIds), inArray(skills.knowledgeAssetId, assetIds)))
    ])
    return mapCompatibleCuratedEvidencePack(pack, { experiences: experienceRows, projects: projectRows, skills: skillRows })
  }
}
