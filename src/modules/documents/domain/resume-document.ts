import { ResumeLanguage, ResumeLength } from "./model.js"

export const resumeFormats = ["markdown", "html", "pdf"] as const
export type ResumeFormat = typeof resumeFormats[number]

export const resumeTemplateIds = ["ats-clean-v1"] as const
export type ResumeTemplateId = typeof resumeTemplateIds[number]

export const resumeDocumentSchemaVersion = "resume-document/v1"
export const resumeRendererVersion = "resume-renderer/v1"
export const atsCleanTemplateVersion = "ats-clean-v1/1"
export const supportedResumePlanSchemaVersions = ["resume-content-plan/v2"] as const

export interface ResumeSourceProvenance {
  sourceDocumentId: string
  sourceReferenceId?: string
  knowledgeAssetId?: string
  locator?: string
}

export interface ProvenancedText {
  value: string
  provenance: ResumeSourceProvenance[]
}

export interface CandidateLink extends ProvenancedText {
  label: string
}

export interface CandidateResumeMetadata {
  name?: ProvenancedText
  headline?: ProvenancedText
  location?: ProvenancedText
  email?: ProvenancedText
  phone?: ProvenancedText
  links: CandidateLink[]
  profileSourceDocumentId?: string
  profileKnowledgeAssetId?: string
}

export interface ResumeDocumentHeader {
  name: string
  headline?: string
  location?: string
  email?: string
  phone?: string
  links: Array<{ label: string; url: string }>
}

export interface ResumeDocumentEvidenceText {
  text: string
  supportingEvidenceIds: string[]
}

export interface ResumeDocumentExperience {
  sourceExperienceId: string
  role: string
  organization: string
  startDate: string
  endDate: string
  context?: string
  summary?: ResumeDocumentEvidenceText
  achievements: ResumeDocumentEvidenceText[]
}

export interface ResumeDocumentSkillGroup {
  name: string
  skills: string[]
  supportingEvidenceIds: string[]
}

export interface ResumeDocumentProvenance {
  jobDescriptionId: string
  jobAnalysisId?: string
  curatedEvidencePackId: string
  resumeContentPlanId: string
  selectedEvidenceIds: string[]
  omittedEvidence: Array<{ evidenceId: string; reason: string; explanation: string }>
  uncoveredRequirementIds: string[]
  uncoveredRequirementComponentIds: string[]
  candidateMetadata: ResumeSourceProvenance[]
}

export interface ResumeDocument {
  schemaVersion: typeof resumeDocumentSchemaVersion
  language: ResumeLanguage
  length: ResumeLength
  templateId: ResumeTemplateId
  templateVersion: string
  header: ResumeDocumentHeader
  professionalSummary?: ResumeDocumentEvidenceText
  skillGroups: ResumeDocumentSkillGroup[]
  experiences: ResumeDocumentExperience[]
  education: Array<{ title: string; details?: string }>
  certifications: Array<{ title: string; details?: string }>
  provenance: ResumeDocumentProvenance
}

export interface RenderedResume {
  bytes: Uint8Array
  format: ResumeFormat
  mediaType: string
  templateId: ResumeTemplateId
  templateVersion: string
  rendererVersion: string
  pageCount?: number
  extractedText?: string
}

export interface ResumeArtifactManifest {
  schemaVersion: "resume-artifact-manifest/v1"
  artifactId: string
  renderingIdentity: string
  generationIdentity: string
  jobDescriptionId: string
  jobAnalysisId?: string
  curatedEvidencePackId: string
  resumeContentPlanId: string
  format: ResumeFormat
  language: ResumeLanguage
  length: ResumeLength
  templateId: ResumeTemplateId
  templateVersion: string
  rendererVersion: string
  artifactPath: string
  manifestPath: string
  mediaType: string
  checksum: string
  byteCount: number
  pageCount?: number
  generatedAt: string
  evidenceAccounting: {
    selectedEvidenceIds: string[]
    omittedEvidence: Array<{ evidenceId: string; reason: string; explanation: string }>
    contentReferences: Array<{ path: string; supportingEvidenceIds: string[] }>
  }
  candidateMetadataProvenance: ResumeSourceProvenance[]
  requirementCoverage: Array<{
    requirementId: string
    coverageStatus: string
    selectedEvidenceIds: string[]
    components: Array<{ componentId: string; coverageStatus: string; selectedEvidenceIds: string[] }>
  }>
  knownGaps: { requirementIds: string[]; componentIds: string[] }
  validation: { renderable: true; meaningfulText: boolean; pageCount?: number }
  alignment: { kind: "evidence-coverage"; universalAtsScore: false }
}

export interface GeneratedResumeArtifact {
  id: string
  renderingIdentity: string
  generationIdentity: string
  jobDescriptionId: string
  jobAnalysisId?: string
  curatedEvidencePackId: string
  resumeContentPlanId: string
  format: ResumeFormat
  language: ResumeLanguage
  length: ResumeLength
  templateId: ResumeTemplateId
  templateVersion: string
  rendererVersion: string
  artifactPath: string
  manifestPath: string
  mediaType: string
  checksum: string
  byteCount: number
  pageCount?: number
  manifest: ResumeArtifactManifest
  createdAt: Date
}

export interface GenerateResumeResult {
  artifact: GeneratedResumeArtifact
  outputPath: string
  manifestPath: string
  reused: boolean
  selectedEvidenceCount: number
}
