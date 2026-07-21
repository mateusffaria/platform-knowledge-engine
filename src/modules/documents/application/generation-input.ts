import { CandidateResumeMetadata } from "../domain/resume-document.js"
import { ResumeContentPlan } from "../domain/model.js"

export interface ResumeGenerationRequirementComponent {
  componentId: string
  coverageStatus: string
  selectedEvidenceIds: string[]
}

export interface ResumeGenerationRequirementCoverage {
  requirementId: string
  coverageStatus: string
  selectedEvidenceIds: string[]
  components: ResumeGenerationRequirementComponent[]
}

export interface ResumeGenerationPackMetadata {
  id: string
  jobDescriptionId: string
  jobAnalysisId?: string
  requirementCoverage: ResumeGenerationRequirementCoverage[]
}

export interface ResumeGenerationSource {
  curatedEvidencePack: ResumeGenerationPackMetadata
  selectedEvidenceIds: string[]
  discardedEvidenceIds: string[]
  sourceDocumentIds: string[]
}

export interface ResumeGenerationInput {
  plan: ResumeContentPlan
  source: ResumeGenerationSource
  candidate: CandidateResumeMetadata
}

export function freezeResumeGenerationInput(input: ResumeGenerationInput): ResumeGenerationInput {
  return Object.freeze({
    plan: Object.freeze({ ...input.plan }),
    source: Object.freeze({
      ...input.source,
      selectedEvidenceIds: Object.freeze([...input.source.selectedEvidenceIds]) as unknown as string[],
      discardedEvidenceIds: Object.freeze([...input.source.discardedEvidenceIds]) as unknown as string[],
      sourceDocumentIds: Object.freeze([...input.source.sourceDocumentIds]) as unknown as string[]
    }),
    candidate: Object.freeze({ ...input.candidate })
  })
}
