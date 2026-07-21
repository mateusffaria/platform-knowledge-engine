export type ResumeLanguage = "pt-BR" | "en"
export type ResumeLength = "concise" | "standard" | "detailed"
export type ResumeExaggerationRisk = "low" | "medium" | "high"

export const resumeLengthProfiles: Readonly<Record<ResumeLength, { maxWords: number; maxBullets: number }>> = Object.freeze({
  concise: Object.freeze({ maxWords: 350, maxBullets: 4 }),
  standard: Object.freeze({ maxWords: 650, maxBullets: 8 }),
  detailed: Object.freeze({ maxWords: 1_000, maxBullets: 12 })
})

export interface PlannedSummary {
  text: string
  supportingEvidenceIds: string[]
}

export interface PlannedBullet {
  text: string
  supportingEvidenceIds: string[]
  targetRequirementIds: string[]
  targetRequirementComponentIds?: string[]
  sourceOrganizationOrExperienceId: string
  exaggerationRisk: ResumeExaggerationRisk
  warnings: string[]
}

export interface PlannedExperience {
  sourceExperienceId: string
  organization?: string
  role?: string
  startDate?: string
  endDate?: string
  summary?: PlannedSummary
  bullets: PlannedBullet[]
}

export interface PlannedSkillGroup {
  name: string
  skills: string[]
  supportingEvidenceIds: string[]
}

export interface OmittedEvidence {
  evidenceId: string
  reason: "relevance" | "length" | "redundancy" | "other"
  explanation: string
}

export interface ResumeContentPlan {
  id: string
  planIdentity: string
  schemaVersion: string
  jobDescriptionId: string
  curatedEvidencePackId: string
  language: ResumeLanguage
  length: ResumeLength
  professionalSummary: PlannedSummary
  plannedExperiences: PlannedExperience[]
  plannedSkillGroups: PlannedSkillGroup[]
  selectedEvidenceIds: string[]
  omittedEvidence: OmittedEvidence[]
  uncoveredRequirementIds: string[]
  uncoveredRequirementComponentIds?: string[]
  warnings: string[]
  provider: string
  model: string
  promptVersion: string
  createdAt: Date
}

export const resumeContentPlanSchemaVersion = "resume-content-plan/v2"
