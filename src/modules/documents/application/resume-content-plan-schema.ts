import { z } from "zod"

import { ResumeContentPlan } from "../domain/model.js"
import { isExperienceCapableEvidence, ResumePlanningInput } from "./planning-input.js"

const nonEmptyIds = z.array(z.string().min(1))
const summarySchema = z.object({ text: z.string().min(1), supportingEvidenceIds: nonEmptyIds.min(1) }).strict()
const bulletSchema = z.object({
  text: z.string().min(1),
  supportingEvidenceIds: nonEmptyIds.min(1),
  targetRequirementIds: nonEmptyIds,
  targetRequirementComponentIds: nonEmptyIds.optional(),
  sourceOrganizationOrExperienceId: z.string().min(1),
  exaggerationRisk: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string())
}).strict()
const experienceSchema = z.object({
  sourceExperienceId: z.string().min(1),
  organization: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  summary: summarySchema.optional(),
  bullets: z.array(bulletSchema)
}).strict()
const skillGroupSchema = z.object({
  name: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  supportingEvidenceIds: nonEmptyIds.min(1)
}).strict()
const omittedSchema = z.object({
  evidenceId: z.string().min(1),
  reason: z.enum(["relevance", "length", "redundancy", "other"]),
  explanation: z.string().min(1)
}).strict()

export const resumePlanDraftSchema = z.object({
  professionalSummary: summarySchema,
  plannedExperiences: z.array(experienceSchema),
  plannedSkillGroups: z.array(skillGroupSchema),
  selectedEvidenceIds: nonEmptyIds,
  omittedEvidence: z.array(omittedSchema),
  uncoveredRequirementIds: nonEmptyIds,
  uncoveredRequirementComponentIds: nonEmptyIds.optional(),
  warnings: z.array(z.string())
}).strict()

export type ResumePlanDraft = z.infer<typeof resumePlanDraftSchema>

export const persistedResumeContentPlanSchema = resumePlanDraftSchema.extend({
  id: z.string().uuid(),
  planIdentity: z.string().length(64),
  schemaVersion: z.string().min(1),
  jobDescriptionId: z.string().min(1),
  curatedEvidencePackId: z.string().min(1),
  language: z.enum(["pt-BR", "en"]),
  length: z.enum(["concise", "standard", "detailed"]),
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  createdAt: z.coerce.date()
}).strict()

export const resumePlanOutputJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["professionalSummary", "plannedExperiences", "plannedSkillGroups", "selectedEvidenceIds", "omittedEvidence", "uncoveredRequirementIds", "uncoveredRequirementComponentIds", "warnings"],
  properties: {
    professionalSummary: { $ref: "#/$defs/summary" },
    plannedExperiences: { type: "array", items: { $ref: "#/$defs/experience" } },
    plannedSkillGroups: { type: "array", items: { $ref: "#/$defs/skillGroup" } },
    selectedEvidenceIds: { type: "array", description: "Exact unique union of eligibleEvidence IDs cited by generated content; these are used evidence IDs.", items: { type: "string" } },
    omittedEvidence: { type: "array", description: "Every eligibleEvidence item not cited by generated content, and no ineligible IDs.", items: { $ref: "#/$defs/omitted" } },
    uncoveredRequirementIds: { type: "array", description: "Exact set of requirement IDs in the uncoveredRequirementIds namespace supplied by the prompt.", items: { type: "string" } },
    uncoveredRequirementComponentIds: { type: "array", description: "Exact set of atomic component IDs in the uncoveredRequirementComponentIds namespace supplied by the prompt.", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } }
  },
  $defs: {
    summary: { type: "object", additionalProperties: false, required: ["text", "supportingEvidenceIds"], properties: { text: { type: "string" }, supportingEvidenceIds: { type: "array", minItems: 1, items: { type: "string" } } } },
    experienceSummary: { type: "object", additionalProperties: false, required: ["text", "supportingEvidenceIds"], properties: { text: { type: "string" }, supportingEvidenceIds: { type: "array", minItems: 1, description: "Experience-capable evidence IDs supporting this experience summary; never skill-only IDs.", items: { type: "string" } } } },
    bullet: { type: "object", additionalProperties: false, required: ["text", "supportingEvidenceIds", "targetRequirementIds", "targetRequirementComponentIds", "sourceOrganizationOrExperienceId", "exaggerationRisk", "warnings"], properties: { text: { type: "string" }, supportingEvidenceIds: { type: "array", minItems: 1, description: "Experience-capable evidence IDs supporting this bullet; never skill-only or requirement IDs.", items: { type: "string" } }, targetRequirementIds: { type: "array", description: "Parent requirement IDs traceable from targetRequirementComponentIds.", items: { type: "string" } }, targetRequirementComponentIds: { type: "array", description: "Covered atomic component IDs supported by this bullet's supportingEvidenceIds.", items: { type: "string" } }, sourceOrganizationOrExperienceId: { type: "string" }, exaggerationRisk: { type: "string", enum: ["low", "medium", "high"] }, warnings: { type: "array", items: { type: "string" } } } },
    experience: { type: "object", additionalProperties: false, required: ["sourceExperienceId", "bullets"], properties: { sourceExperienceId: { type: "string" }, organization: { type: "string" }, role: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" }, summary: { $ref: "#/$defs/experienceSummary" }, bullets: { type: "array", items: { $ref: "#/$defs/bullet" } } } },
    skillGroup: { type: "object", additionalProperties: false, required: ["name", "skills", "supportingEvidenceIds"], properties: { name: { type: "string" }, skills: { type: "array", minItems: 1, items: { type: "string" } }, supportingEvidenceIds: { type: "array", minItems: 1, items: { type: "string" } } } },
    omitted: { type: "object", additionalProperties: false, required: ["evidenceId", "reason", "explanation"], properties: { evidenceId: { type: "string", description: "ID of one unused item from eligibleEvidence; never an unknown or ineligible ID." }, reason: { type: "string", enum: ["relevance", "length", "redundancy", "other"] }, explanation: { type: "string" } } }
  }
}

function constrainArrayItems(arraySchema: Record<string, any>, values: string[]): void {
  arraySchema.uniqueItems = true
  if (values.length === 0) {
    arraySchema.maxItems = 0
    return
  }
  arraySchema.items = { ...arraySchema.items, enum: values }
}

interface ResumePlanSchemaRepairFeedback {
  issues: readonly {
    code: string
    value?: string
  }[]
}

export function buildResumePlanOutputJsonSchema(input: ResumePlanningInput, repair?: ResumePlanSchemaRepairFeedback): Record<string, unknown> {
  const schema = structuredClone(resumePlanOutputJsonSchema) as Record<string, any>
  const properties = schema.properties as Record<string, any>
  const definitions = schema.$defs as Record<string, any>
  const eligibleEvidenceIds = input.curatedEvidencePack.selectedEvidence.map((evidence) => evidence.evidenceClaimId).sort()
  const experienceCapableEvidence = input.curatedEvidencePack.selectedEvidence.filter(isExperienceCapableEvidence)
  const experienceEvidenceIds = experienceCapableEvidence.map((evidence) => evidence.evidenceClaimId).sort()
  const experienceEvidenceIdSet = new Set(experienceEvidenceIds)
  const selectedAndOmittedIds = new Set(
    repair?.issues
      .filter((issue) => issue.code === "selected_and_omitted" && issue.value !== undefined && eligibleEvidenceIds.includes(issue.value))
      .map((issue) => issue.value as string) ?? []
  )
  const omittableEvidenceIds = eligibleEvidenceIds.filter((evidenceId) => !selectedAndOmittedIds.has(evidenceId))
  const targetableRequirementIds = input.curatedEvidencePack.requirements
    .filter((requirement) => requirement.coverageStatus !== "missing" && requirement.selectedEvidenceIds.some((evidenceId) => experienceEvidenceIdSet.has(evidenceId)))
    .map((requirement) => requirement.requirementId)
    .sort()
  const uncoveredRequirementIds = input.curatedEvidencePack.requirements
    .filter((requirement) => requirement.coverageStatus === "missing" || requirement.selectedEvidenceIds.length === 0)
    .map((requirement) => requirement.requirementId)
    .sort()
  const targetableComponentIds = input.curatedEvidencePack.requirements.flatMap((requirement) => requirement.components)
    .filter((component) => component.coverageStatus !== "missing" && component.selectedEvidenceIds.some((evidenceId) => experienceEvidenceIdSet.has(evidenceId)))
    .map((component) => component.componentId)
    .sort()
  const uncoveredComponentIds = input.curatedEvidencePack.requirements.flatMap((requirement) => requirement.components)
    .filter((component) => component.coverageStatus === "missing" || component.selectedEvidenceIds.length === 0)
    .map((component) => component.componentId)
    .sort()
  const experienceSourceIds = [...new Set(experienceCapableEvidence.map((evidence) => evidence.presentation.sourceOrganizationOrExperienceId))].sort()

  constrainArrayItems(properties.selectedEvidenceIds, eligibleEvidenceIds)
  constrainArrayItems(properties.uncoveredRequirementIds, uncoveredRequirementIds)
  constrainArrayItems(properties.uncoveredRequirementComponentIds, uncoveredComponentIds)
  constrainArrayItems(definitions.summary.properties.supportingEvidenceIds, eligibleEvidenceIds)
  constrainArrayItems(definitions.experienceSummary.properties.supportingEvidenceIds, experienceEvidenceIds)
  constrainArrayItems(definitions.bullet.properties.supportingEvidenceIds, experienceEvidenceIds)
  constrainArrayItems(definitions.bullet.properties.targetRequirementIds, targetableRequirementIds)
  constrainArrayItems(definitions.bullet.properties.targetRequirementComponentIds, targetableComponentIds)
  constrainArrayItems(definitions.skillGroup.properties.supportingEvidenceIds, eligibleEvidenceIds)
  if (omittableEvidenceIds.length > 0) {
    definitions.omitted.properties.evidenceId.enum = omittableEvidenceIds
  } else if (eligibleEvidenceIds.length > 0) {
    properties.omittedEvidence.maxItems = 0
  }
  if (experienceSourceIds.length > 0) {
    definitions.experience.properties.sourceExperienceId.enum = experienceSourceIds
    definitions.bullet.properties.sourceOrganizationOrExperienceId.enum = experienceSourceIds
  } else {
    properties.plannedExperiences.maxItems = 0
  }
  return schema
}

export interface ResumePlanSchemaDiagnostic {
  errorCode: "invalid_json" | "invalid_schema"
  errorSummary: string
  issues: string[]
}

export class ResumePlanSchemaError extends Error {
  constructor(readonly diagnostic: ResumePlanSchemaDiagnostic) {
    super(diagnostic.errorSummary)
    this.name = "ResumePlanSchemaError"
  }
}

export function parseResumePlanDraft(content: string): ResumePlanDraft {
  let decoded: unknown
  try { decoded = JSON.parse(content) } catch {
    throw new ResumePlanSchemaError({ errorCode: "invalid_json", errorSummary: "Resume planner returned invalid JSON.", issues: [] })
  }
  const parsed = resumePlanDraftSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new ResumePlanSchemaError({
      errorCode: "invalid_schema",
      errorSummary: "Resume planner returned output that does not match the required schema.",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).sort()
    })
  }
  return parsed.data
}

export function parsePersistedResumeContentPlan(value: unknown): ResumeContentPlan {
  const parsed = persistedResumeContentPlanSchema.safeParse(value)
  if (!parsed.success) throw new Error("Persisted resume content plan is invalid.")
  return parsed.data
}
