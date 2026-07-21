import { ResumeGenerationInput } from "./generation-input.js"
import { assertRenderableInput, assertValidResumeDocument } from "./resume-generation-validator.js"
import { atsCleanTemplateVersion, ResumeDocument, resumeDocumentSchemaVersion, ResumeSourceProvenance } from "../domain/resume-document.js"

function dateSortValue(value: string): number {
  if (/^(?:present|current|presente|atual)$/iu.test(value.trim())) return Number.MAX_SAFE_INTEGER
  const normalized = value.trim().match(/^(\d{4})(?:-(\d{1,2}))?$/u)
  if (normalized) return Number(normalized[1]) * 100 + Number(normalized[2] ?? 12)
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function formatResumeDate(value: string, language: ResumeDocument["language"]): string {
  const trimmed = value.trim()
  if (/^(?:present|current|presente|atual)$/iu.test(trimmed)) return language === "pt-BR" ? "Atual" : "Present"
  const match = trimmed.match(/^(\d{4})(?:-(\d{1,2}))?$/u)
  if (!match) return trimmed
  if (!match[2]) return match[1]
  return new Intl.DateTimeFormat(language, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
}

function candidateProvenance(input: ResumeGenerationInput): ResumeSourceProvenance[] {
  const fields = [input.candidate.name, input.candidate.headline, input.candidate.location, input.candidate.email, input.candidate.phone, ...input.candidate.links]
  const byIdentity = new Map<string, ResumeSourceProvenance>()
  for (const field of fields) for (const item of field?.provenance ?? []) byIdentity.set(`${item.sourceDocumentId}:${item.sourceReferenceId ?? ""}:${item.knowledgeAssetId ?? ""}`, item)
  return [...byIdentity.values()].sort((left, right) => `${left.sourceDocumentId}:${left.sourceReferenceId ?? ""}`.localeCompare(`${right.sourceDocumentId}:${right.sourceReferenceId ?? ""}`))
}

export function buildResumeDocument(input: ResumeGenerationInput): ResumeDocument {
  assertRenderableInput(input)
  const { plan, source, candidate } = input
  const document: ResumeDocument = {
    schemaVersion: resumeDocumentSchemaVersion,
    language: plan.language,
    length: plan.length,
    templateId: "ats-clean-v1",
    templateVersion: atsCleanTemplateVersion,
    header: {
      name: candidate.name!.value,
      ...(candidate.headline ? { headline: candidate.headline.value } : {}),
      ...(candidate.location ? { location: candidate.location.value } : {}),
      ...(candidate.email ? { email: candidate.email.value } : {}),
      ...(candidate.phone ? { phone: candidate.phone.value } : {}),
      links: candidate.links.map((link) => ({ label: link.label, url: link.value }))
    },
    professionalSummary: plan.professionalSummary.text.trim() ? { text: plan.professionalSummary.text, supportingEvidenceIds: [...plan.professionalSummary.supportingEvidenceIds] } : undefined,
    skillGroups: plan.plannedSkillGroups.map((group) => ({ name: group.name, skills: [...group.skills], supportingEvidenceIds: [...group.supportingEvidenceIds] })),
    experiences: [...plan.plannedExperiences].sort((left, right) => dateSortValue(right.endDate!) - dateSortValue(left.endDate!) || dateSortValue(right.startDate!) - dateSortValue(left.startDate!) || left.sourceExperienceId.localeCompare(right.sourceExperienceId)).map((experience) => ({
      sourceExperienceId: experience.sourceExperienceId,
      role: experience.role!,
      organization: experience.organization!,
      startDate: formatResumeDate(experience.startDate!, plan.language),
      endDate: formatResumeDate(experience.endDate!, plan.language),
      ...(experience.summary ? { summary: { text: experience.summary.text, supportingEvidenceIds: [...experience.summary.supportingEvidenceIds] } } : {}),
      achievements: experience.bullets.map((bullet) => ({ text: bullet.text, supportingEvidenceIds: [...bullet.supportingEvidenceIds] }))
    })),
    education: [],
    certifications: [],
    provenance: {
      jobDescriptionId: plan.jobDescriptionId,
      ...(source.curatedEvidencePack.jobAnalysisId ? { jobAnalysisId: source.curatedEvidencePack.jobAnalysisId } : {}),
      curatedEvidencePackId: plan.curatedEvidencePackId,
      resumeContentPlanId: plan.id,
      selectedEvidenceIds: [...plan.selectedEvidenceIds].sort(),
      omittedEvidence: plan.omittedEvidence.map((item) => ({ ...item })),
      uncoveredRequirementIds: [...plan.uncoveredRequirementIds].sort(),
      uncoveredRequirementComponentIds: [...(plan.uncoveredRequirementComponentIds ?? [])].sort(),
      candidateMetadata: candidateProvenance(input)
    }
  }
  assertValidResumeDocument(document)
  return document
}
