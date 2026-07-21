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
  componentIds: readonly string[]
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
  components: readonly ResumePlanningRequirementComponent[]
}

export interface ResumePlanningRequirementComponent {
  componentId: string
  componentIndex: number
  componentText: string
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
  missingComponentIds: readonly string[]
  warnings: readonly string[]
  limitations: readonly string[]
}

export interface ResumePlanningInput {
  curatedEvidencePack: CompatibleCuratedEvidencePack
}

export function isExperienceCapableEvidence(evidence: ResumePlanningEvidence): boolean {
  return (evidence.claimType ?? evidence.subjectType).normalize("NFKC").trim().toLocaleLowerCase("en") !== "skill"
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values])
}

export function freezeResumePlanningInput(input: ResumePlanningInput): ResumePlanningInput {
  const pack = input.curatedEvidencePack
  const normalizedRequirements = pack.requirements.map((requirement) => {
    const components = requirement.components ?? [{
      componentId: `legacy-component:${requirement.requirementId}`,
      componentIndex: 0,
      componentText: requirement.requirementText,
      coverageStatus: requirement.coverageStatus,
      selectedEvidenceIds: requirement.selectedEvidenceIds
    }]
    return { ...requirement, components }
  })
  const componentIdsByRequirement = new Map(normalizedRequirements.map((requirement) => [requirement.requirementId, requirement.components.map((component) => component.componentId)]))
  const missingComponentIds = pack.missingComponentIds ?? normalizedRequirements.flatMap((requirement) => requirement.components
    .filter((component) => component.coverageStatus === "missing" || component.selectedEvidenceIds.length === 0)
    .map((component) => component.componentId))
  return Object.freeze({
    curatedEvidencePack: Object.freeze({
      ...pack,
      requirements: freezeArray(normalizedRequirements.map((requirement) => Object.freeze({
        ...requirement,
        selectedEvidenceIds: freezeArray(requirement.selectedEvidenceIds),
        components: freezeArray(requirement.components.map((component) => Object.freeze({ ...component, selectedEvidenceIds: freezeArray(component.selectedEvidenceIds) })))
      }))),
      selectedEvidence: freezeArray(pack.selectedEvidence.map((evidence) => Object.freeze({
        ...evidence,
        requirementIds: freezeArray(evidence.requirementIds),
        componentIds: freezeArray(evidence.componentIds ?? evidence.requirementIds.flatMap((requirementId) => componentIdsByRequirement.get(requirementId) ?? [])),
        provenance: freezeArray(evidence.provenance.map((source) => Object.freeze({ ...source }))),
        presentation: Object.freeze({
          ...evidence.presentation,
          technologies: freezeArray(evidence.presentation.technologies),
          metrics: freezeArray(evidence.presentation.metrics)
        })
      }))),
      discardedEvidenceIds: freezeArray(pack.discardedEvidenceIds),
      missingRequirementIds: freezeArray(pack.missingRequirementIds),
      missingComponentIds: freezeArray(missingComponentIds),
      warnings: freezeArray(pack.warnings),
      limitations: freezeArray(pack.limitations)
    })
  })
}
