import { ResumeGenerationInput } from "./generation-input.js"
import { GeneratedResumeArtifact, RenderedResume, ResumeArtifactManifest, ResumeDocument } from "../domain/resume-document.js"

export function contentEvidenceReferences(document: ResumeDocument): ResumeArtifactManifest["evidenceAccounting"]["contentReferences"] {
  return [
    ...(document.professionalSummary ? [{ path: "professionalSummary", supportingEvidenceIds: [...document.professionalSummary.supportingEvidenceIds] }] : []),
    ...document.skillGroups.map((group, index) => ({ path: `skillGroups[${index}]`, supportingEvidenceIds: [...group.supportingEvidenceIds] })),
    ...document.experiences.flatMap((experience, experienceIndex) => [
      ...(experience.summary ? [{ path: `experiences[${experienceIndex}].summary`, supportingEvidenceIds: [...experience.summary.supportingEvidenceIds] }] : []),
      ...experience.achievements.map((achievement, achievementIndex) => ({ path: `experiences[${experienceIndex}].achievements[${achievementIndex}]`, supportingEvidenceIds: [...achievement.supportingEvidenceIds] }))
    ])
  ]
}

export function buildResumeArtifactManifest(input: {
  id: string
  renderingIdentity: string
  generationIdentity: string
  generationInput: ResumeGenerationInput
  document: ResumeDocument
  rendered: RenderedResume
  artifactPath: string
  manifestPath: string
  checksum: string
  generatedAt: Date
}): ResumeArtifactManifest {
  const pack = input.generationInput.source.curatedEvidencePack
  return {
    schemaVersion: "resume-artifact-manifest/v1",
    artifactId: input.id,
    renderingIdentity: input.renderingIdentity,
    generationIdentity: input.generationIdentity,
    jobDescriptionId: input.document.provenance.jobDescriptionId,
    ...(input.document.provenance.jobAnalysisId ? { jobAnalysisId: input.document.provenance.jobAnalysisId } : {}),
    curatedEvidencePackId: input.document.provenance.curatedEvidencePackId,
    resumeContentPlanId: input.document.provenance.resumeContentPlanId,
    format: input.rendered.format,
    language: input.document.language,
    length: input.document.length,
    templateId: input.document.templateId,
    templateVersion: input.document.templateVersion,
    rendererVersion: input.rendered.rendererVersion,
    artifactPath: input.artifactPath,
    manifestPath: input.manifestPath,
    mediaType: input.rendered.mediaType,
    checksum: input.checksum,
    byteCount: input.rendered.bytes.byteLength,
    ...(input.rendered.pageCount ? { pageCount: input.rendered.pageCount } : {}),
    generatedAt: input.generatedAt.toISOString(),
    evidenceAccounting: {
      selectedEvidenceIds: [...input.document.provenance.selectedEvidenceIds],
      omittedEvidence: input.document.provenance.omittedEvidence.map((item) => ({ ...item })),
      contentReferences: contentEvidenceReferences(input.document)
    },
    candidateMetadataProvenance: input.document.provenance.candidateMetadata.map((item) => ({ ...item })),
    requirementCoverage: pack.requirementCoverage.map((requirement) => ({
      requirementId: requirement.requirementId,
      coverageStatus: requirement.coverageStatus,
      selectedEvidenceIds: [...requirement.selectedEvidenceIds].sort(),
      components: requirement.components.map((component) => ({ componentId: component.componentId, coverageStatus: component.coverageStatus, selectedEvidenceIds: [...component.selectedEvidenceIds].sort() }))
    })),
    knownGaps: { requirementIds: [...input.document.provenance.uncoveredRequirementIds], componentIds: [...input.document.provenance.uncoveredRequirementComponentIds] },
    validation: { renderable: true, meaningfulText: input.rendered.format !== "pdf" || Boolean(input.rendered.extractedText?.trim()), ...(input.rendered.pageCount ? { pageCount: input.rendered.pageCount } : {}) },
    alignment: { kind: "evidence-coverage", universalAtsScore: false }
  }
}

export function artifactFromManifest(manifest: ResumeArtifactManifest): GeneratedResumeArtifact {
  return {
    id: manifest.artifactId,
    renderingIdentity: manifest.renderingIdentity,
    generationIdentity: manifest.generationIdentity,
    jobDescriptionId: manifest.jobDescriptionId,
    ...(manifest.jobAnalysisId ? { jobAnalysisId: manifest.jobAnalysisId } : {}),
    curatedEvidencePackId: manifest.curatedEvidencePackId,
    resumeContentPlanId: manifest.resumeContentPlanId,
    format: manifest.format,
    language: manifest.language,
    length: manifest.length,
    templateId: manifest.templateId,
    templateVersion: manifest.templateVersion,
    rendererVersion: manifest.rendererVersion,
    artifactPath: manifest.artifactPath,
    manifestPath: manifest.manifestPath,
    mediaType: manifest.mediaType,
    checksum: manifest.checksum,
    byteCount: manifest.byteCount,
    ...(manifest.pageCount ? { pageCount: manifest.pageCount } : {}),
    manifest,
    createdAt: new Date(manifest.generatedAt)
  }
}
