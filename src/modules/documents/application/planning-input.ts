import { ResumeExaggerationRisk } from "../domain/model.js"

export interface CanonicalPresentationMetadata {
  sourceOrganizationOrExperienceId: string
  organization?: string
  role?: string
  startDate?: string
  endDate?: string
  technologies: readonly string[]
  metrics: readonly string[]
}

export interface ResumePlanningEvidence {
  evidenceClaimId: string
  knowledgeAssetId: string
  subjectAssetId?: string
  subjectType: string
  claimType?: string
  claimCategory?: string
  predicate?: string
  claimText: string
  valueText?: string
  valueUnit?: string
  claimStatus?: string
  contribution: string
  exaggerationRisk: ResumeExaggerationRisk
  requirementIds: readonly string[]
  presentation: CanonicalPresentationMetadata
  provenance: readonly {
    sourceDocumentId: string
    sourceReferenceId?: string
    locator?: string
  }[]
}

export interface ResumePlanningRequirement {
  requirementId: string
  requirementText: string
  importance: "required" | "preferred"
  coverageStatus: "strong" | "partial" | "weak" | "missing"
  selectedEvidenceIds: readonly string[]
}

export interface CompatibleCuratedEvidencePack {
  id: string
  jobDescriptionId: string
  createdAt: Date
  provider: string
  model: string
  promptVersion: string
  requirements: readonly ResumePlanningRequirement[]
  selectedEvidence: readonly ResumePlanningEvidence[]
  discardedEvidenceIds: readonly string[]
  missingRequirementIds: readonly string[]
  warnings: readonly string[]
  limitations: readonly string[]
}

export interface ResumePlanningInput {
  curatedEvidencePack: CompatibleCuratedEvidencePack
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values])
}

export function freezeResumePlanningInput(input: ResumePlanningInput): ResumePlanningInput {
  const pack = input.curatedEvidencePack
  return Object.freeze({
    curatedEvidencePack: Object.freeze({
      ...pack,
      requirements: freezeArray(pack.requirements.map((requirement) => Object.freeze({ ...requirement, selectedEvidenceIds: freezeArray(requirement.selectedEvidenceIds) }))),
      selectedEvidence: freezeArray(pack.selectedEvidence.map((evidence) => Object.freeze({
        ...evidence,
        requirementIds: freezeArray(evidence.requirementIds),
        provenance: freezeArray(evidence.provenance.map((source) => Object.freeze({ ...source }))),
        presentation: Object.freeze({
          ...evidence.presentation,
          technologies: freezeArray(evidence.presentation.technologies),
          metrics: freezeArray(evidence.presentation.metrics)
        })
      }))),
      discardedEvidenceIds: freezeArray(pack.discardedEvidenceIds),
      missingRequirementIds: freezeArray(pack.missingRequirementIds),
      warnings: freezeArray(pack.warnings),
      limitations: freezeArray(pack.limitations)
    })
  })
}
