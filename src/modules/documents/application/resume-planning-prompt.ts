import { ResumeLanguage, ResumeLength, resumeLengthProfiles } from "../domain/model.js"
import { ResumePlanningInput } from "./planning-input.js"
import { ResumePlanningRepairFeedback } from "./ports/resume-content-planner.js"

export const resumePlanningPromptVersion = "resume-planning/v5"

export const resumePlanningSystemPrompt = `You are a closed-world resume content planner. Use only the supplied eligibleEvidence and canonical presentation metadata. Return JSON matching the supplied schema. UUIDs belong to distinct namespaces: evidence IDs may appear only in supportingEvidenceIds, selectedEvidenceIds, and omittedEvidence.evidenceId; requirement IDs may appear only in targetRequirementIds and uncoveredRequirementIds; source IDs may appear only in sourceExperienceId and sourceOrganizationOrExperienceId. Never substitute an ID from one namespace into another. eligibleEvidence is the complete evidence set available to you. Every factual text field must cite eligible evidence IDs. In the output, selectedEvidenceIds means evidence actually used and must be the exact unique union of IDs cited by output content. omittedEvidence means eligible evidence not used because of relevance, length, or redundancy; it must contain every unused eligibleEvidence item and no other IDs. Each targetRequirementId must be targetable and supported by that bullet's supportingEvidenceIds. uncoveredRequirementIds must exactly match the supplied uncovered namespace. Never invent or infer an identifier. Preserve metrics, dates, organizations, roles, technologies, factual meaning, evidence strength, and missing requirements exactly. Skill-only evidence cannot become production experience. Prefer omission to unsupported claims. If repairRequest is present, regenerate the entire response and correct every listed issue without weakening or deleting supported content locally. Do not render PDF, DOCX, HTML, Markdown, or visual layout.`

function sorted<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)))
}

export function buildResumePlanningUserPrompt(input: ResumePlanningInput, language: ResumeLanguage, length: ResumeLength, repair?: ResumePlanningRepairFeedback): string {
  const pack = input.curatedEvidencePack
  const eligibleEvidenceIds = pack.selectedEvidence.map((evidence) => evidence.evidenceClaimId).sort()
  const targetableRequirementIds = pack.requirements.filter((requirement) => requirement.coverageStatus !== "missing" && requirement.selectedEvidenceIds.length > 0).map((requirement) => requirement.requirementId).sort()
  const uncoveredRequirementIds = pack.requirements.filter((requirement) => requirement.coverageStatus === "missing" || requirement.selectedEvidenceIds.length === 0).map((requirement) => requirement.requirementId).sort()
  const sourceIds = [...new Set(pack.selectedEvidence.map((evidence) => evidence.presentation.sourceOrganizationOrExperienceId))].sort()
  const payload = {
    requestedLanguage: language,
    requestedLength: length,
    limits: resumeLengthProfiles[length],
    identifierNamespaces: {
      eligibleEvidenceIds,
      targetableRequirementIds,
      uncoveredRequirementIds,
      sourceIds
    },
    curatedEvidencePack: {
      id: pack.id,
      jobDescriptionId: pack.jobDescriptionId,
      requirements: sorted(pack.requirements, (value) => value.requirementId).map((value) => {
        const { selectedEvidenceIds, ...requirement } = value
        return { ...requirement, eligibleEvidenceIds: [...selectedEvidenceIds].sort() }
      }),
      eligibleEvidence: sorted(pack.selectedEvidence, (value) => value.evidenceClaimId).map((value) => ({
        ...value,
        requirementIds: [...value.requirementIds].sort(),
        provenance: sorted(value.provenance, (source) => `${source.sourceDocumentId}:${source.sourceReferenceId ?? ""}:${source.locator ?? ""}`),
        presentation: { ...value.presentation, technologies: [...value.presentation.technologies].sort(), metrics: [...value.presentation.metrics].sort() }
      })),
      missingRequirementIds: [...pack.missingRequirementIds].sort(),
      warnings: [...pack.warnings],
      limitations: [...pack.limitations]
    },
    ...(repair ? {
      repairRequest: {
        instruction: "The previous complete response failed reference or accounting validation. Regenerate the complete response and follow each issue's resolution. A value is included only when that identifier is already allowlisted in identifierNamespaces.",
        issues: sorted(repair.issues, (issue) => `${issue.path}:${issue.code}`).map((issue) => ({
          code: issue.code,
          path: issue.path,
          ...(issue.value === undefined ? {} : { value: issue.value }),
          resolution: issue.resolution
        }))
      }
    } : {})
  }
  return JSON.stringify(payload)
}
