import { Command, InvalidArgumentError } from "commander"

import { createTerminalProgress } from "../../../../shared/cli/terminal-progress.js"
import { ResumePlanningProgressStage } from "../../application/use-cases/plan-resume-content.js"
import { ResumeGenerationProgressStage } from "../../application/use-cases/generate-resume.js"
import { ResumeContentPlan, ResumeLanguage, ResumeLength } from "../../domain/model.js"
import { GenerateResumeResult, ResumeFormat, resumeFormats, ResumeTemplateId, resumeTemplateIds } from "../../domain/resume-document.js"
import { createProductionDocumentsServices } from "../../infrastructure/documents-runner.js"

export type DocumentsServicesFactory = typeof createProductionDocumentsServices
export type DocumentsProgressFactory = typeof createTerminalProgress

const progressMessages: Record<ResumePlanningProgressStage, string> = {
  loading_evidence: "Loading the latest compatible Curated Evidence Pack",
  checking_existing_plan: "Checking for an existing immutable Resume Content Plan",
  generating_content: "Generating schema-bound resume content with the configured model",
  repairing_content: "Regenerating content after evidence-accounting validation",
  validating_content: "Validating evidence grounding and factual preservation",
  persisting_plan: "Persisting the immutable Resume Content Plan",
  reusing_existing_plan: "Reusing the existing immutable Resume Content Plan"
}

const generationProgressMessages: Record<ResumeGenerationProgressStage, string> = {
  loading_plan: "Loading the latest compatible Resume Content Plan",
  loading_provenance: "Loading exact evidence and job-analysis provenance",
  loading_candidate: "Loading trusted candidate presentation metadata",
  validating_input: "Validating the plan, evidence accounting, and candidate metadata",
  checking_existing_artifact: "Checking for a reusable resume artifact",
  building_document: "Building the deterministic ATS ResumeDocument",
  rendering_markdown: "Rendering the Markdown resume",
  rendering_html: "Rendering the standalone HTML resume",
  rendering_pdf: "Launching local Chromium and rendering the selectable-text PDF",
  validating_artifact: "Validating rendered sections, text extraction, and checksum",
  writing_output: "Writing the resume artifact and provenance manifest",
  persisting_artifact: "Persisting immutable artifact metadata",
  reusing_artifact: "Reusing the existing checksum-verified resume artifact"
}

function parseLanguage(value: string): ResumeLanguage {
  if (value === "pt-BR" || value === "en") return value
  throw new InvalidArgumentError("Resume language must be pt-BR or en.")
}

function parseLength(value: string): ResumeLength {
  if (value === "concise" || value === "standard" || value === "detailed") return value
  throw new InvalidArgumentError("Resume length must be concise, standard, or detailed.")
}

function parseFormat(value: string): ResumeFormat {
  if (resumeFormats.includes(value as ResumeFormat)) return value as ResumeFormat
  throw new InvalidArgumentError("Resume format must be markdown, html, or pdf.")
}

function parseTemplate(value: string): ResumeTemplateId {
  if (resumeTemplateIds.includes(value as ResumeTemplateId)) return value as ResumeTemplateId
  throw new InvalidArgumentError("Resume template must be ats-clean-v1.")
}

function printCompactPlan(plan: ResumeContentPlan, verbose: boolean): void {
  console.log(`Resume Content Plan (${plan.language}, ${plan.length})`)
  console.log(plan.professionalSummary.text)
  for (const experience of plan.plannedExperiences) {
    console.log(`\n${[experience.role, experience.organization].filter(Boolean).join(" — ")}`)
    for (const bullet of experience.bullets) console.log(`- ${bullet.text}`)
  }
  if (plan.plannedSkillGroups.length > 0) {
    console.log("\nSkills")
    for (const group of plan.plannedSkillGroups) console.log(`${group.name}: ${group.skills.join(", ")}`)
  }
  if (!verbose) return
  console.log("\nTraceability")
  console.log(`Plan: ${plan.id}`)
  console.log(`Curated Evidence Pack: ${plan.curatedEvidencePackId}`)
  console.log(`Selected evidence: ${plan.selectedEvidenceIds.join(", ") || "none"}`)
  for (const omitted of plan.omittedEvidence) console.log(`Omitted ${omitted.evidenceId} (${omitted.reason}): ${omitted.explanation}`)
  console.log(`Uncovered requirements: ${plan.uncoveredRequirementIds.join(", ") || "none"}`)
  console.log(`Uncovered atomic components: ${plan.uncoveredRequirementComponentIds?.join(", ") || "none"}`)
  for (const experience of plan.plannedExperiences) {
    for (const bullet of experience.bullets) {
      if ((bullet.targetRequirementComponentIds?.length ?? 0) > 0) console.log(`Target components: ${bullet.targetRequirementComponentIds!.join(", ")}`)
    }
  }
  for (const warning of plan.warnings) console.log(`Warning: ${warning}`)
  console.log(`Generation: ${plan.provider}/${plan.model}, ${plan.promptVersion}`)
}

function reportError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

function printGenerationResult(result: GenerateResumeResult): void {
  console.log("✓ Resume generated")
  console.log(`format=${result.artifact.format}`)
  console.log(`template=${result.artifact.templateId}`)
  console.log(`plan=${result.artifact.resumeContentPlanId}`)
  console.log(`evidenceItems=${result.selectedEvidenceCount}`)
  console.log(`reused=${result.reused}`)
  console.log(`output=${result.outputPath}`)
  console.log(`manifest=${result.manifestPath}`)
}

export function registerDocumentsCommands(
  program: Command,
  createServices: DocumentsServicesFactory = createProductionDocumentsServices,
  createProgress: DocumentsProgressFactory = createTerminalProgress
): void {
  const documents = program.command("documents").description("Plan and render evidence-grounded professional documents")
  const resume = documents.command("resume").description("Work with evidence-grounded resumes")
  resume.command("plan")
    .description("Create or reuse a validated Resume Content Plan")
    .argument("<job-id>", "job description ID")
    .option("--model <model>", "override the configured LLM model")
    .option("--language <language>", "plan language: pt-BR or en", parseLanguage, "en")
    .option("--length <length>", "plan length: concise, standard, or detailed", parseLength, "standard")
    .option("--force", "bypass plan reuse and persist a fresh immutable plan")
    .option("--json", "print exactly one machine-readable plan")
    .option("--verbose", "include grounding and generation details in the terminal preview")
    .option("--no-progress", "disable interactive terminal progress")
    .action(async (jobDescriptionId: string, options: { model?: string; language: ResumeLanguage; length: ResumeLength; force?: boolean; json?: boolean; verbose?: boolean; progress?: boolean }) => {
      const progressEnabled = options.json !== true && options.progress !== false
      const progress = createProgress({ enabled: progressEnabled })
      let services: ReturnType<DocumentsServicesFactory> | undefined
      try {
        progress.start("Preparing resume content planning")
        services = createServices()
        const onProgress = progressEnabled
          ? (stage: ResumePlanningProgressStage) => progress.update(progressMessages[stage])
          : undefined
        const plan = await services.planResumeContent.execute({
          jobDescriptionId,
          model: options.model,
          language: options.language,
          length: options.length,
          ...(options.force ? { force: true } : {}),
          ...(onProgress ? { onProgress } : {})
        })
        progress.update("Flushing planning telemetry and closing resources")
        const closing = services
        services = undefined
        await closing.close()
        progress.succeed(`Resume Content Plan ready (${plan.selectedEvidenceIds.length} evidence item(s))`)
        if (options.json) console.log(JSON.stringify(plan, null, 2))
        else printCompactPlan(plan, options.verbose === true)
      } catch (error) {
        progress.fail("Resume content planning failed")
        reportError(error)
      } finally { await services?.close() }
    })

  resume.command("generate")
    .description("Generate or reuse a deterministic ATS resume artifact")
    .argument("<job-id>", "job description ID")
    .option("--format <format>", "output format: markdown, html, or pdf", parseFormat, "pdf")
    .option("--language <language>", "resume language: pt-BR or en", parseLanguage, "en")
    .option("--length <length>", "resume length: concise, standard, or detailed", parseLength, "standard")
    .option("--template <template>", "resume template", parseTemplate, "ats-clean-v1")
    .option("--output <path>", "artifact output path")
    .option("--force", "rerender and persist a new immutable artifact generation")
    .option("--json", "print exactly one machine-readable generation result")
    .option("--no-progress", "disable interactive terminal progress")
    .action(async (jobDescriptionId: string, options: { format: ResumeFormat; language: ResumeLanguage; length: ResumeLength; template: ResumeTemplateId; output?: string; force?: boolean; json?: boolean; progress?: boolean }) => {
      const progressEnabled = options.json !== true && options.progress !== false
      const terminal = createProgress({ enabled: progressEnabled })
      let services: ReturnType<DocumentsServicesFactory> | undefined
      try {
        terminal.start("Preparing deterministic resume generation")
        services = createServices()
        const onProgress = progressEnabled ? (stage: ResumeGenerationProgressStage) => terminal.update(generationProgressMessages[stage]) : undefined
        const result = await services.generateResume.execute({
          jobDescriptionId,
          format: options.format,
          language: options.language,
          length: options.length,
          templateId: options.template,
          ...(options.output ? { outputPath: options.output } : {}),
          ...(options.force ? { force: true } : {}),
          ...(onProgress ? { onProgress } : {})
        })
        terminal.update("Flushing generation telemetry and closing resources")
        const closing = services
        services = undefined
        await closing.close()
        terminal.succeed(result.reused ? "Resume artifact reused" : "Resume generated")
        if (options.json) console.log(JSON.stringify(result, null, 2))
        else printGenerationResult(result)
      } catch (error) {
        terminal.fail("Resume generation failed")
        reportError(error)
      } finally { await services?.close() }
    })
}
