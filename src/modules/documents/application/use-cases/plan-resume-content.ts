import { randomUUID } from "node:crypto"

import { ResumeContentPlan, ResumeLanguage, ResumeLength, resumeContentPlanSchemaVersion } from "../../domain/model.js"
import { freezeResumePlanningInput } from "../planning-input.js"
import { assertValidResumePlanDraft, isRepairableReferenceIssue, ResumePlanValidationError } from "../resume-plan-validator.js"
import { CompatibleCuratedEvidenceReader } from "../ports/compatible-curated-evidence-reader.js"
import { ResumeContentPlanRepository } from "../ports/resume-content-plan-repository.js"
import { ResumeContentPlanner, ResumePlanningRepairFeedback } from "../ports/resume-content-planner.js"
import { FailOpenResumePlanningObservability, NoopResumePlanningObservability, ResumePlanningObservability } from "../ports/resume-planning-observability.js"

export interface PlanResumeContentCommand {
  jobDescriptionId: string
  language: ResumeLanguage
  length: ResumeLength
  model?: string
  onProgress?: (stage: ResumePlanningProgressStage) => void
}

export type ResumePlanningProgressStage =
  | "loading_evidence"
  | "checking_existing_plan"
  | "generating_content"
  | "repairing_content"
  | "validating_content"
  | "persisting_plan"
  | "reusing_existing_plan"

export interface PlanResumeContentDependencies {
  curatedEvidenceReader: CompatibleCuratedEvidenceReader
  planRepository: ResumeContentPlanRepository
  planner: ResumeContentPlanner
  observability?: ResumePlanningObservability
  now?: () => Date
  newId?: () => string
}

export class CompatibleCuratedEvidencePackNotFoundError extends Error {
  constructor(jobDescriptionId: string) {
    super(`No compatible persisted Curated Evidence Pack was found for job ${jobDescriptionId}. Run pke jobs reason ${jobDescriptionId} first.`)
    this.name = "CompatibleCuratedEvidencePackNotFoundError"
  }
}

function reportProgress(command: PlanResumeContentCommand, stage: ResumePlanningProgressStage): void {
  try { command.onProgress?.(stage) } catch {
    // Terminal feedback must never change the planning result.
  }
}

function repairResolution(code: ResumePlanValidationError["issues"][number]["code"]): string {
  switch (code) {
    case "duplicate_evidence_id": return "Use each eligible evidence ID at most once in an individual ID list."
    case "unknown_evidence_id": return "Replace the reference with an ID from the field's allowlisted namespace, or omit the unsupported reference."
    case "discarded_evidence_id": return "Do not reference discarded evidence; regenerate using eligibleEvidence only."
    case "unaccounted_evidence_id": return "Either cite this eligible evidence in content or include it exactly once in omittedEvidence."
    case "selected_and_omitted": return "This evidence is both used and omitted. If it remains cited, keep it in selectedEvidenceIds and remove it from omittedEvidence; otherwise remove every citation and keep it omitted."
    case "selected_set_mismatch": return "Recompute selectedEvidenceIds as the exact unique union of all supportingEvidenceIds."
    case "uncovered_requirement_mismatch": return "Set uncoveredRequirementIds to the exact uncoveredRequirementIds namespace supplied in the prompt."
    case "unsupported_requirement": return "Target only a targetable requirement supported by this bullet's supportingEvidenceIds; never target an uncovered requirement."
    case "skill_promoted_to_experience": return "Remove skill-only evidence from plannedExperiences. Use only experienceEvidenceIds there, and place supported skill-only content in professionalSummary or plannedSkillGroups."
    default: return "Regenerate the complete response and correct this validation issue."
  }
}

export function createPlanResumeContentUseCase(dependencies: PlanResumeContentDependencies) {
  const observability = new FailOpenResumePlanningObservability(dependencies.observability ?? new NoopResumePlanningObservability())
  const now = dependencies.now ?? (() => new Date())
  const newId = dependencies.newId ?? randomUUID

  return {
    async execute(command: PlanResumeContentCommand): Promise<ResumeContentPlan> {
      const rootAttributes = { jobDescriptionId: command.jobDescriptionId, language: command.language, length: command.length, requestedModel: command.model }
      return observability.run("resume_content_planning", rootAttributes, async () => {
        const startedAt = performance.now()
        const trace = observability.trace("resume-content-planning", rootAttributes)
        let outcome = "failure"
        try {
        reportProgress(command, "loading_evidence")
        const pack = await observability.run("input_loading", { jobDescriptionId: command.jobDescriptionId }, () => dependencies.curatedEvidenceReader.findLatestCompatible(command.jobDescriptionId))
        if (!pack) throw new CompatibleCuratedEvidencePackNotFoundError(command.jobDescriptionId)
        const input = freezeResumePlanningInput({ curatedEvidencePack: pack })
        const plannerCommand = { input, language: command.language, length: command.length, model: command.model }
        const identity = dependencies.planner.getIdentity(plannerCommand)
        const attributes = { provider: identity.provider, model: identity.model, prompt_version: identity.promptVersion, language: command.language, length: command.length }
        reportProgress(command, "checking_existing_plan")
        const existing = await observability.run("identity_lookup", { planIdentity: identity.planIdentity }, () => dependencies.planRepository.findByPlanIdentity(identity.planIdentity))
        if (existing) {
          reportProgress(command, "reusing_existing_plan")
          outcome = "cache_hit"
          observability.record("cacheHits", 1, attributes)
          await trace.event("cache_hit", { planIdentity: identity.planIdentity, curatedEvidencePackId: pack.id })
          return existing
        }

        let generated: Awaited<ReturnType<ResumeContentPlanner["plan"]>> | undefined
        let repair: ResumePlanningRepairFeedback | undefined
        for (let generationAttempt = 1; generationAttempt <= 2; generationAttempt += 1) {
          reportProgress(command, repair ? "repairing_content" : "generating_content")
          generated = await dependencies.planner.plan({ ...plannerCommand, ...(repair ? { repair } : {}) })
          if (generated.provider !== identity.provider || generated.model !== identity.model) throw new Error("Resume planner provider identity changed during generation.")
          await trace.generation?.({
            name: "resume_content_generation",
            model: generated.model,
            metadata: { provider: generated.provider, promptVersion: identity.promptVersion, language: command.language, length: command.length, generationAttempt, repair: repair !== undefined },
            usage: generated.usage
          })
          try {
            reportProgress(command, "validating_content")
            await observability.run("deterministic_validation", { planIdentity: identity.planIdentity, generationAttempt }, () => assertValidResumePlanDraft(generated!.draft, input, command.language, command.length))
            break
          } catch (error) {
            if (!(error instanceof ResumePlanValidationError)) throw error
            const repairScheduled = generationAttempt === 1 && error.issues.length > 0 && error.issues.every(isRepairableReferenceIssue)
            observability.record("validationFailures", error.issues.length, { ...attributes, outcome: repairScheduled ? "repair_requested" : "rejected" })
            await trace.event(repairScheduled ? "validation_repair_requested" : "validation_rejected", {
              issueCount: error.issues.length,
              issueCodes: [...new Set(error.issues.map((issue) => issue.code))].join(","),
              issuePaths: error.issues.slice(0, 16).map((issue) => issue.path).join(","),
              issueDetails: error.issues.slice(0, 16).map((issue) => `${issue.code}@${issue.path}`).join(","),
              generationAttempt
            })
            if (!repairScheduled) throw error
            const allowlistedIdentifiers = new Set([
              ...input.curatedEvidencePack.selectedEvidence.map((evidence) => evidence.evidenceClaimId),
              ...input.curatedEvidencePack.requirements.map((requirement) => requirement.requirementId),
              ...input.curatedEvidencePack.selectedEvidence.map((evidence) => evidence.presentation.sourceOrganizationOrExperienceId)
            ])
            repair = {
              issues: error.issues.map((issue) => ({
                code: issue.code,
                path: issue.path,
                ...(issue.value !== undefined && allowlistedIdentifiers.has(issue.value) ? { value: issue.value } : {}),
                resolution: repairResolution(issue.code)
              }))
            }
          }
        }
        if (!generated) throw new Error("Resume planner did not produce a generation.")

        const plan: ResumeContentPlan = {
          id: newId(),
          planIdentity: identity.planIdentity,
          schemaVersion: resumeContentPlanSchemaVersion,
          jobDescriptionId: command.jobDescriptionId,
          curatedEvidencePackId: pack.id,
          language: command.language,
          length: command.length,
          ...generated.draft,
          provider: identity.provider,
          model: identity.model,
          promptVersion: identity.promptVersion,
          createdAt: now()
        }
        reportProgress(command, "persisting_plan")
        const stored = await observability.run("persistence", { planIdentity: identity.planIdentity }, () => dependencies.planRepository.save(plan))
        outcome = "success"
        await trace.event("planning_succeeded", { planId: stored.id, planIdentity: identity.planIdentity, curatedEvidencePackId: pack.id })
        return stored
        } catch (error) {
          await trace.event("planning_failed", { errorClass: error instanceof Error ? error.name : "unknown" })
          throw error
        } finally {
          observability.record("commandDuration", performance.now() - startedAt, { language: command.language, length: command.length, outcome })
          await trace.flush()
        }
      })
    }
  }
}
