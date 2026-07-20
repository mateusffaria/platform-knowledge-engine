import { ResumeLength, resumeLengthProfiles } from "../domain/model.js"
import { isExperienceCapableEvidence, ResumePlanningEvidence, ResumePlanningInput } from "./planning-input.js"
import { ResumePlanDraft } from "./resume-content-plan-schema.js"

export type ResumePlanValidationIssueCode =
  | "duplicate_evidence_id"
  | "unknown_evidence_id"
  | "discarded_evidence_id"
  | "unaccounted_evidence_id"
  | "selected_and_omitted"
  | "selected_set_mismatch"
  | "uncovered_requirement_mismatch"
  | "unsupported_requirement"
  | "unsupported_metric"
  | "canonical_presentation_mismatch"
  | "unsupported_technology"
  | "evidence_strength_inflation"
  | "skill_promoted_to_experience"
  | "language_mismatch"
  | "length_exceeded"

export interface ResumePlanValidationIssue {
  code: ResumePlanValidationIssueCode
  path: string
  message: string
  value?: string
}

export class ResumePlanValidationError extends Error {
  constructor(readonly issues: ResumePlanValidationIssue[]) {
    const summary = issues.slice(0, 8).map((issue) => `${issue.code}@${issue.path}${issue.value === undefined ? "" : `=${issue.value}`}`).join(", ")
    super(`Resume Content Plan failed deterministic validation with ${issues.length} issue(s)${summary ? `: ${summary}${issues.length > 8 ? ", …" : ""}` : "."}`)
    this.name = "ResumePlanValidationError"
  }
}

const repairableEvidenceIssueCodes = new Set<ResumePlanValidationIssueCode>([
  "duplicate_evidence_id",
  "unknown_evidence_id",
  "discarded_evidence_id",
  "unaccounted_evidence_id",
  "selected_and_omitted",
  "selected_set_mismatch",
  "uncovered_requirement_mismatch",
  "unsupported_requirement",
  "skill_promoted_to_experience"
])

export function isRepairableReferenceIssue(issue: ResumePlanValidationIssue): boolean {
  return repairableEvidenceIssueCodes.has(issue.code)
}

interface GroundedText {
  path: string
  supportingEvidencePath: string
  text: string
  supportingEvidenceIds: string[]
  kind: "summary" | "experience" | "bullet" | "skills"
}

const technologyCatalog = [
  "aws", "azure", "c#", "c++", "docker", "elasticsearch", "gcp", "git", "golang", "grafana", "java", "javascript", "kafka", "kotlin", "kubernetes", "langfuse", "linux", "mongodb", "mysql", "node.js", "nodejs", "opentelemetry", "oracle", "postgres", "postgresql", "prometheus", "python", "react", "redis", "rust", "spring", "terraform", "typescript", "vue"
]

const englishMarkers = new Set(["a", "an", "and", "built", "developed", "for", "improved", "in", "led", "of", "the", "to", "with"])
const portugueseMarkers = new Set(["a", "com", "da", "de", "desenvolveu", "e", "em", "liderou", "melhorou", "o", "para", "por", "uma"])
const ownershipPattern = /\b(owned|solely|spearheaded|led|architected|liderou|foi responsável sozinho|concebeu)\b/i
const metricPattern = /(?:[$€£R$]\s?\d[\d.,]*|\d+(?:[.,]\d+)?\s?(?:%|x|ms|s|seconds?|segundos?|hours?|horas?|days?|dias?|users?|usuários?|requests?|requisições?))/giu

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en")
}

function uniqueDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) seen.has(value) ? duplicates.add(value) : seen.add(value)
  return [...duplicates].sort()
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && new Set(left).size === new Set(right).size && left.every((value) => right.includes(value))
}

function groundedTexts(draft: ResumePlanDraft): GroundedText[] {
  const values: GroundedText[] = [{ path: "professionalSummary.text", supportingEvidencePath: "professionalSummary.supportingEvidenceIds", text: draft.professionalSummary.text, supportingEvidenceIds: draft.professionalSummary.supportingEvidenceIds, kind: "summary" }]
  draft.plannedExperiences.forEach((experience, experienceIndex) => {
    if (experience.summary) values.push({ path: `plannedExperiences[${experienceIndex}].summary.text`, supportingEvidencePath: `plannedExperiences[${experienceIndex}].summary.supportingEvidenceIds`, text: experience.summary.text, supportingEvidenceIds: experience.summary.supportingEvidenceIds, kind: "experience" })
    experience.bullets.forEach((bullet, bulletIndex) => values.push({ path: `plannedExperiences[${experienceIndex}].bullets[${bulletIndex}].text`, supportingEvidencePath: `plannedExperiences[${experienceIndex}].bullets[${bulletIndex}].supportingEvidenceIds`, text: bullet.text, supportingEvidenceIds: bullet.supportingEvidenceIds, kind: "bullet" }))
  })
  draft.plannedSkillGroups.forEach((group, index) => values.push({ path: `plannedSkillGroups[${index}]`, supportingEvidencePath: `plannedSkillGroups[${index}].supportingEvidenceIds`, text: `${group.name} ${group.skills.join(" ")}`, supportingEvidenceIds: group.supportingEvidenceIds, kind: "skills" }))
  return values
}

function evidenceById(input: ResumePlanningInput): Map<string, ResumePlanningEvidence> {
  return new Map(input.curatedEvidencePack.selectedEvidence.map((evidence) => [evidence.evidenceClaimId, evidence]))
}

function allowedSourceText(evidence: ResumePlanningEvidence): string {
  return [evidence.claimText, evidence.valueText, evidence.valueUnit, evidence.contribution, ...evidence.presentation.technologies, ...evidence.presentation.metrics].filter(Boolean).join(" ")
}

function extractMetrics(text: string): string[] {
  return [...text.matchAll(metricPattern)].map((match) => normalized(match[0])).sort()
}

function languageScore(text: string, markers: Set<string>): number {
  return text.normalize("NFKD").replace(/[^\p{L}\s-]/gu, " ").toLocaleLowerCase("en").split(/\s+/).filter((word) => markers.has(word)).length
}

function allNaturalLanguage(draft: ResumePlanDraft): string {
  return [
    ...groundedTexts(draft).map((value) => value.text),
    ...draft.omittedEvidence.map((value) => value.explanation),
    ...draft.warnings
  ].join(" ")
}

function wordCount(draft: ResumePlanDraft): number {
  return allNaturalLanguage(draft).trim().split(/\s+/u).filter(Boolean).length
}

function addEvidenceMembershipIssues(draft: ResumePlanDraft, input: ResumePlanningInput, issues: ResumePlanValidationIssue[]): void {
  const allowed = new Set(input.curatedEvidencePack.selectedEvidence.map((evidence) => evidence.evidenceClaimId))
  const discarded = new Set(input.curatedEvidencePack.discardedEvidenceIds)
  const grounded = groundedTexts(draft)
  const used = grounded.flatMap((text) => text.supportingEvidenceIds)
  const omitted = draft.omittedEvidence.map((value) => value.evidenceId)

  for (const { path, values } of [
    { path: "selectedEvidenceIds", values: draft.selectedEvidenceIds },
    { path: "omittedEvidence", values: omitted }
  ]) {
    for (const duplicate of uniqueDuplicates(values)) issues.push({ code: "duplicate_evidence_id", path, value: duplicate, message: `Evidence ${duplicate} is duplicated.` })
    values.forEach((value, index) => {
      const valuePath = path === "omittedEvidence" ? `omittedEvidence[${index}].evidenceId` : `selectedEvidenceIds[${index}]`
      if (!allowed.has(value)) {
        if (discarded.has(value)) issues.push({ code: "discarded_evidence_id", path: valuePath, value, message: `Discarded evidence ${value} cannot be used.` })
        else issues.push({ code: "unknown_evidence_id", path: valuePath, value, message: `Evidence ${value} is not selected in the Curated Evidence Pack.` })
      }
    })
  }
  for (const text of grounded) {
    for (const duplicate of uniqueDuplicates(text.supportingEvidenceIds)) issues.push({ code: "duplicate_evidence_id", path: text.supportingEvidencePath, value: duplicate, message: `Evidence ${duplicate} is duplicated within one supporting-evidence list.` })
    text.supportingEvidenceIds.forEach((value, index) => {
      const valuePath = `${text.supportingEvidencePath}[${index}]`
      if (!allowed.has(value)) {
        if (discarded.has(value)) issues.push({ code: "discarded_evidence_id", path: valuePath, value, message: `Discarded evidence ${value} cannot be used.` })
        else issues.push({ code: "unknown_evidence_id", path: valuePath, value, message: `Evidence ${value} is not selected in the Curated Evidence Pack.` })
      }
    })
  }

  const distinctUsed = [...new Set(used)].sort()
  if (!sameSet(draft.selectedEvidenceIds, distinctUsed)) issues.push({ code: "selected_set_mismatch", path: "selectedEvidenceIds", message: "Selected evidence IDs must exactly match evidence cited by generated content." })
  for (const value of draft.selectedEvidenceIds.filter((id) => omitted.includes(id))) {
    const omittedIndex = omitted.indexOf(value)
    issues.push({ code: "selected_and_omitted", path: `omittedEvidence[${omittedIndex}].evidenceId`, value, message: `Evidence ${value} cannot be both selected and omitted.` })
  }
  for (const value of [...allowed].filter((id) => !draft.selectedEvidenceIds.includes(id) && !omitted.includes(id)).sort()) issues.push({ code: "unaccounted_evidence_id", path: "omittedEvidence", value, message: `Selected pack evidence ${value} must be used or explicitly omitted.` })
}

function addRequirementIssues(draft: ResumePlanDraft, input: ResumePlanningInput, issues: ResumePlanValidationIssue[]): void {
  const uncovered = input.curatedEvidencePack.requirements.filter((requirement) => requirement.coverageStatus === "missing" || requirement.selectedEvidenceIds.length === 0).map((requirement) => requirement.requirementId).sort()
  if (!sameSet(draft.uncoveredRequirementIds, uncovered)) issues.push({ code: "uncovered_requirement_mismatch", path: "uncoveredRequirementIds", message: "Uncovered requirements must exactly match missing Curated Evidence Pack requirements." })
  const requirements = new Map(input.curatedEvidencePack.requirements.map((requirement) => [requirement.requirementId, requirement]))
  draft.plannedExperiences.forEach((experience, experienceIndex) => experience.bullets.forEach((bullet, bulletIndex) => {
    bullet.targetRequirementIds.forEach((requirementId, requirementIndex) => {
      const requirement = requirements.get(requirementId)
      const supported = requirement && requirement.coverageStatus !== "missing" && bullet.supportingEvidenceIds.some((id) => requirement.selectedEvidenceIds.includes(id))
      if (!supported) issues.push({ code: "unsupported_requirement", path: `plannedExperiences[${experienceIndex}].bullets[${bulletIndex}].targetRequirementIds[${requirementIndex}]`, value: requirementId, message: `Requirement ${requirementId} is not covered by the bullet's cited evidence.` })
    })
  }))
}

function addFactIssues(draft: ResumePlanDraft, input: ResumePlanningInput, issues: ResumePlanValidationIssue[]): void {
  const byId = evidenceById(input)
  for (const grounded of groundedTexts(draft)) {
    const cited = grounded.supportingEvidenceIds.map((id) => byId.get(id)).filter((value): value is ResumePlanningEvidence => value !== undefined)
    const sourceText = cited.map(allowedSourceText).join(" ")
    const allowedMetrics = new Set(extractMetrics(sourceText))
    for (const metric of extractMetrics(grounded.text)) if (!allowedMetrics.has(metric)) issues.push({ code: "unsupported_metric", path: grounded.path, value: metric, message: `Metric ${metric} is not present in cited evidence.` })

    const lowerText = normalized(grounded.text)
    for (const technology of technologyCatalog) {
      const appears = new RegExp(`(^|[^\\p{L}\\p{N}])${technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "iu").test(lowerText)
      if (appears && !normalized(sourceText).includes(normalized(technology))) issues.push({ code: "unsupported_technology", path: grounded.path, value: technology, message: `Technology ${technology} is not supported by cited evidence.` })
    }
  }

  draft.plannedExperiences.forEach((experience, index) => {
    const citedIds = [...(experience.summary?.supportingEvidenceIds ?? []), ...experience.bullets.flatMap((bullet) => bullet.supportingEvidenceIds)]
    const cited = citedIds.map((id) => byId.get(id)).filter((value): value is ResumePlanningEvidence => value !== undefined)
    const matching = cited.filter((evidence) => evidence.presentation.sourceOrganizationOrExperienceId === experience.sourceExperienceId)
    const matches = (field: "organization" | "role" | "startDate" | "endDate", value: string | undefined) => value === undefined || matching.some((evidence) => evidence.presentation[field] === value)
    for (const field of ["organization", "role", "startDate", "endDate"] as const) if (!matches(field, experience[field])) issues.push({ code: "canonical_presentation_mismatch", path: `plannedExperiences.${index}.${field}`, value: experience[field], message: `${field} must exactly match cited canonical presentation metadata.` })
    if (matching.length === 0) issues.push({ code: "canonical_presentation_mismatch", path: `plannedExperiences.${index}.sourceExperienceId`, value: experience.sourceExperienceId, message: "Source experience ID is not supported by cited evidence." })
    experience.bullets.forEach((bullet, bulletIndex) => {
      const bulletEvidence = bullet.supportingEvidenceIds.map((id) => byId.get(id)).filter((value): value is ResumePlanningEvidence => value !== undefined)
      if (!bulletEvidence.some((evidence) => evidence.presentation.sourceOrganizationOrExperienceId === bullet.sourceOrganizationOrExperienceId)) {
        issues.push({ code: "canonical_presentation_mismatch", path: `plannedExperiences.${index}.bullets.${bulletIndex}.sourceOrganizationOrExperienceId`, value: bullet.sourceOrganizationOrExperienceId, message: "Bullet source organization or experience ID must match cited canonical presentation metadata." })
      }
    })
  })

  draft.plannedSkillGroups.forEach((group, index) => {
    const cited = group.supportingEvidenceIds.map((id) => byId.get(id)).filter((value): value is ResumePlanningEvidence => value !== undefined)
    const supportedText = normalized(cited.map(allowedSourceText).join(" "))
    group.skills.forEach((skill) => {
      if (!supportedText.includes(normalized(skill))) issues.push({ code: "unsupported_technology", path: `plannedSkillGroups.${index}.skills`, value: skill, message: `Skill ${skill} is not supported by cited evidence.` })
    })
  })
}

function addStrengthIssues(draft: ResumePlanDraft, input: ResumePlanningInput, issues: ResumePlanValidationIssue[]): void {
  const byId = evidenceById(input)
  const riskRank = { low: 0, medium: 1, high: 2 } as const
  draft.plannedExperiences.forEach((experience, experienceIndex) => {
    if (experience.summary) {
      const cited = experience.summary.supportingEvidenceIds.map((id) => byId.get(id)).filter((value): value is ResumePlanningEvidence => value !== undefined)
      if (cited.length > 0 && cited.every((evidence) => !isExperienceCapableEvidence(evidence))) issues.push({ code: "skill_promoted_to_experience", path: `plannedExperiences.${experienceIndex}.summary`, message: "Skill-only evidence cannot support a production experience summary." })
    }
    experience.bullets.forEach((bullet, bulletIndex) => {
      const cited = bullet.supportingEvidenceIds.map((id) => byId.get(id)).filter((value): value is ResumePlanningEvidence => value !== undefined)
      const requiredRisk = cited.reduce<"low" | "medium" | "high">((risk, evidence) => riskRank[evidence.exaggerationRisk] > riskRank[risk] ? evidence.exaggerationRisk : risk, "low")
      const path = `plannedExperiences.${experienceIndex}.bullets.${bulletIndex}`
      if (riskRank[bullet.exaggerationRisk] < riskRank[requiredRisk] || (requiredRisk !== "low" && ownershipPattern.test(bullet.text))) issues.push({ code: "evidence_strength_inflation", path, message: "Bullet wording or risk understates the cited evidence's exaggeration risk." })
      if (cited.length > 0 && cited.every((evidence) => !isExperienceCapableEvidence(evidence))) issues.push({ code: "skill_promoted_to_experience", path, message: "Skill-only evidence cannot support a production experience bullet." })
    })
  })
}

function addLanguageAndLengthIssues(draft: ResumePlanDraft, language: "pt-BR" | "en", length: ResumeLength, issues: ResumePlanValidationIssue[]): void {
  const text = allNaturalLanguage(draft)
  const en = languageScore(text, englishMarkers)
  const pt = languageScore(text, portugueseMarkers)
  if ((language === "pt-BR" && en >= pt + 2) || (language === "en" && pt >= en + 2)) issues.push({ code: "language_mismatch", path: "language", message: `Natural-language content does not match requested locale ${language}.` })
  const bullets = draft.plannedExperiences.reduce((count, experience) => count + experience.bullets.length, 0)
  const profile = resumeLengthProfiles[length]
  const words = wordCount(draft)
  if (words > profile.maxWords || bullets > profile.maxBullets) issues.push({ code: "length_exceeded", path: "length", message: `${length} output has ${words} words and ${bullets} bullets; maximum is ${profile.maxWords} words and ${profile.maxBullets} bullets.` })
}

export function validateResumePlanDraft(draft: ResumePlanDraft, input: ResumePlanningInput, language: "pt-BR" | "en", length: ResumeLength): ResumePlanValidationIssue[] {
  const issues: ResumePlanValidationIssue[] = []
  addEvidenceMembershipIssues(draft, input, issues)
  addRequirementIssues(draft, input, issues)
  addFactIssues(draft, input, issues)
  addStrengthIssues(draft, input, issues)
  addLanguageAndLengthIssues(draft, language, length, issues)
  return issues.sort((left, right) => `${left.path}:${left.code}:${left.value ?? ""}`.localeCompare(`${right.path}:${right.code}:${right.value ?? ""}`))
}

export function assertValidResumePlanDraft(draft: ResumePlanDraft, input: ResumePlanningInput, language: "pt-BR" | "en", length: ResumeLength): void {
  const issues = validateResumePlanDraft(draft, input, language, length)
  if (issues.length > 0) throw new ResumePlanValidationError(issues)
}
