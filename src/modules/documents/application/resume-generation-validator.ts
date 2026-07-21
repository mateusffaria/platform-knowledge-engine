import { ResumeGenerationInput } from "./generation-input.js"
import { ResumeDocument, RenderedResume, supportedResumePlanSchemaVersions } from "../domain/resume-document.js"
import { ResumeContentPlan, ResumeLanguage, ResumeLength } from "../domain/model.js"

export type ResumeGenerationIssueCode =
  | "incompatible_plan"
  | "source_mismatch"
  | "missing_candidate_name"
  | "missing_renderable_experience"
  | "missing_required_field"
  | "empty_placeholder"
  | "unknown_evidence_id"
  | "selected_and_omitted"
  | "invalid_output"

export interface ResumeGenerationIssue {
  code: ResumeGenerationIssueCode
  path: string
  value?: string
  message: string
}

export class ResumeGenerationValidationError extends Error {
  constructor(readonly issues: ResumeGenerationIssue[]) {
    super(`Resume generation validation failed: ${issues.map((issue) => `${issue.code}@${issue.path}`).join(", ")}`)
    this.name = "ResumeGenerationValidationError"
  }
}

const placeholder = /^(?:n\/?a|none|null|undefined|tbd|todo|-+)$/iu

export function assertCompatibleResumePlan(plan: ResumeContentPlan, requested: { jobDescriptionId: string; language: ResumeLanguage; length: ResumeLength }): void {
  const issues: ResumeGenerationIssue[] = []
  if (plan.jobDescriptionId !== requested.jobDescriptionId) issues.push({ code: "incompatible_plan", path: "plan.jobDescriptionId", value: plan.jobDescriptionId, message: "Resume Content Plan belongs to a different job description." })
  if (plan.language !== requested.language) issues.push({ code: "incompatible_plan", path: "plan.language", value: plan.language, message: `Resume Content Plan language ${plan.language} does not match requested language ${requested.language}.` })
  if (plan.length !== requested.length) issues.push({ code: "incompatible_plan", path: "plan.length", value: plan.length, message: `Resume Content Plan length ${plan.length} does not match requested length ${requested.length}.` })
  if (!supportedResumePlanSchemaVersions.includes(plan.schemaVersion as typeof supportedResumePlanSchemaVersions[number])) issues.push({ code: "incompatible_plan", path: "plan.schemaVersion", value: plan.schemaVersion, message: `Unsupported Resume Content Plan schema: ${plan.schemaVersion}.` })
  if (issues.length > 0) throw new ResumeGenerationValidationError(issues)
}

function requiredText(value: string | undefined, path: string, issues: ResumeGenerationIssue[]): void {
  if (!value?.trim()) {
    issues.push({ code: "missing_required_field", path, message: `${path} is required.` })
  } else if (placeholder.test(value.trim())) {
    issues.push({ code: "empty_placeholder", path, value, message: `${path} contains an unsupported placeholder.` })
  }
}

export function assertRenderableInput(input: ResumeGenerationInput): void {
  const { plan, source, candidate } = input
  const issues: ResumeGenerationIssue[] = []
  if (!supportedResumePlanSchemaVersions.includes(plan.schemaVersion as typeof supportedResumePlanSchemaVersions[number])) {
    issues.push({ code: "incompatible_plan", path: "plan.schemaVersion", value: plan.schemaVersion, message: `Unsupported Resume Content Plan schema: ${plan.schemaVersion}.` })
  }
  if (plan.curatedEvidencePackId !== source.curatedEvidencePack.id || plan.jobDescriptionId !== source.curatedEvidencePack.jobDescriptionId) {
    issues.push({ code: "source_mismatch", path: "plan.curatedEvidencePackId", value: plan.curatedEvidencePackId, message: "Resume Content Plan does not match its Curated Evidence Pack." })
  }
  if (!candidate.name?.value.trim()) issues.push({ code: "missing_candidate_name", path: "candidate.name", message: "Candidate Name is required. Ingest or correct a professional-profile/v1 Markdown document with an explicit - Name: value." })
  const renderableExperience = plan.plannedExperiences.some((experience) => [experience.role, experience.organization, experience.startDate, experience.endDate].every((value) => value?.trim() && !placeholder.test(value.trim())))
  if (!renderableExperience) issues.push({ code: "missing_renderable_experience", path: "plan.plannedExperiences", message: "At least one renderable planned experience with role, organization, start date, and end date is required. Correct or regenerate the Resume Content Plan." })
  const eligible = new Set(source.selectedEvidenceIds)
  const omitted = new Set(plan.omittedEvidence.map((item) => item.evidenceId))
  for (const id of plan.selectedEvidenceIds) {
    if (omitted.has(id)) issues.push({ code: "selected_and_omitted", path: "plan.selectedEvidenceIds", value: id, message: `Evidence ${id} is both selected and omitted.` })
    if (!eligible.has(id)) issues.push({ code: "unknown_evidence_id", path: "plan.selectedEvidenceIds", value: id, message: `Evidence ${id} is not selected by the exact Curated Evidence Pack.` })
  }
  const references: Array<{ path: string; ids: string[]; text?: string }> = [
    { path: "plan.professionalSummary", ids: plan.professionalSummary.supportingEvidenceIds, text: plan.professionalSummary.text },
    ...plan.plannedSkillGroups.map((group, index) => ({ path: `plan.plannedSkillGroups[${index}]`, ids: group.supportingEvidenceIds, text: `${group.name} ${group.skills.join(" ")}` })),
    ...plan.plannedExperiences.flatMap((experience, experienceIndex) => [
      ...(experience.summary ? [{ path: `plan.plannedExperiences[${experienceIndex}].summary`, ids: experience.summary.supportingEvidenceIds, text: experience.summary.text }] : []),
      ...experience.bullets.map((bullet, bulletIndex) => ({ path: `plan.plannedExperiences[${experienceIndex}].bullets[${bulletIndex}]`, ids: bullet.supportingEvidenceIds, text: bullet.text }))
    ])
  ]
  for (const reference of references) {
    if (reference.text && placeholder.test(reference.text.trim())) issues.push({ code: "empty_placeholder", path: reference.path, value: reference.text, message: `${reference.path} contains an unsupported placeholder.` })
    for (const id of reference.ids) if (!eligible.has(id)) issues.push({ code: "unknown_evidence_id", path: `${reference.path}.supportingEvidenceIds`, value: id, message: `Evidence ${id} is not selected by the exact Curated Evidence Pack.` })
  }
  plan.plannedExperiences.forEach((experience, index) => {
    requiredText(experience.role, `plan.plannedExperiences[${index}].role`, issues)
    requiredText(experience.organization, `plan.plannedExperiences[${index}].organization`, issues)
    requiredText(experience.startDate, `plan.plannedExperiences[${index}].startDate`, issues)
    requiredText(experience.endDate, `plan.plannedExperiences[${index}].endDate`, issues)
  })
  if (issues.length > 0) throw new ResumeGenerationValidationError(issues)
}

function visibleDocumentText(document: ResumeDocument): string {
  return [
    document.header.name, document.header.headline, document.header.location, document.header.email, document.header.phone,
    ...document.header.links.flatMap((link) => [link.label, link.url]), document.professionalSummary?.text,
    ...document.skillGroups.flatMap((group) => [group.name, ...group.skills]),
    ...document.experiences.flatMap((experience) => [experience.role, experience.organization, experience.startDate, experience.endDate, experience.context, experience.summary?.text, ...experience.achievements.map((achievement) => achievement.text)]),
    ...document.education.flatMap((entry) => [entry.title, entry.details]),
    ...document.certifications.flatMap((entry) => [entry.title, entry.details])
  ].filter((value): value is string => Boolean(value)).join("\n")
}

export function assertValidResumeDocument(document: ResumeDocument): void {
  const issues: ResumeGenerationIssue[] = []
  requiredText(document.header.name, "document.header.name", issues)
  if (document.experiences.length === 0) issues.push({ code: "missing_renderable_experience", path: "document.experiences", message: "Professional Experience is required." })
  const visible = visibleDocumentText(document)
  for (const id of document.provenance.selectedEvidenceIds) {
    if (visible.includes(id)) issues.push({ code: "invalid_output", path: "document", value: id, message: "Internal evidence identifiers must not appear in the resume body." })
  }
  if (issues.length > 0) throw new ResumeGenerationValidationError(issues)
}

export function assertValidRenderedResume(rendered: RenderedResume, expectedHeadings: string[]): void {
  const issues: ResumeGenerationIssue[] = []
  if (rendered.bytes.byteLength === 0) issues.push({ code: "invalid_output", path: "rendered.bytes", message: "Rendered output is empty." })
  const text = rendered.format === "pdf" ? (rendered.extractedText ?? "") : new TextDecoder().decode(rendered.bytes)
  const comparableText = rendered.format === "pdf" ? text.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("en") : text
  for (const heading of expectedHeadings) {
    const comparableHeading = rendered.format === "pdf" ? heading.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("en") : heading
    if (!comparableText.includes(comparableHeading)) issues.push({ code: "invalid_output", path: "rendered.content", value: heading, message: `Rendered output is missing expected section ${heading}.` })
  }
  if (rendered.format === "html" && (!text.includes("<!doctype html>") || /<script\b/iu.test(text) || /@import\s|url\s*\(\s*["']?https?:/iu.test(text))) {
    issues.push({ code: "invalid_output", path: "rendered.html", message: "HTML must be standalone, semantic, and free of scripts or remote assets." })
  }
  if (rendered.format === "pdf" && (!rendered.pageCount || rendered.pageCount < 1 || text.trim().length < 20)) {
    issues.push({ code: "invalid_output", path: "rendered.pdf", message: "PDF must contain at least one page and meaningful extractable text." })
  }
  if (issues.length > 0) throw new ResumeGenerationValidationError(issues)
}
