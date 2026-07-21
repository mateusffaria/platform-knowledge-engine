import { Command } from "commander"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { registerDocumentsCommands } from "../src/modules/documents/interfaces/cli/documents-command.js"
import { ResumeGenerationValidationError } from "../src/modules/documents/application/resume-generation-validator.js"

function samplePlan(): ResumeContentPlan {
  return {
    id: "00000000-0000-4000-8000-000000000001", planIdentity: "a".repeat(64), schemaVersion: "resume-content-plan/v2",
    jobDescriptionId: "job-1", curatedEvidencePackId: "pack-1", language: "en", length: "standard",
    professionalSummary: { text: "Built reliable TypeScript services.", supportingEvidenceIds: ["ev-1"] },
    plannedExperiences: [{ sourceExperienceId: "exp-1", organization: "Acme", role: "Engineer", bullets: [{ text: "Improved API latency by 35%.", supportingEvidenceIds: ["ev-1"], targetRequirementIds: ["req-1"], sourceOrganizationOrExperienceId: "exp-1", exaggerationRisk: "low", warnings: [] }] }],
    plannedSkillGroups: [{ name: "Languages", skills: ["TypeScript"], supportingEvidenceIds: ["ev-1"] }], selectedEvidenceIds: ["ev-1"],
    omittedEvidence: [{ evidenceId: "ev-2", reason: "length", explanation: "Concise bound" }], uncoveredRequirementIds: ["req-2"], warnings: ["Missing Kubernetes"],
    provider: "ollama", model: "qwen", promptVersion: "resume-planning/v7", createdAt: new Date("2026-07-20T15:00:00Z")
  }
}

function program(services: any, createProgress?: Parameters<typeof registerDocumentsCommands>[2]): Command {
  const command = new Command()
  command.exitOverride()
  registerDocumentsCommands(command, () => services, createProgress)
  return command
}

function sampleGenerationResult(overrides: Record<string, unknown> = {}): any {
  return {
    artifact: {
      id: "artifact-1", format: "pdf", templateId: "ats-clean-v1", resumeContentPlanId: "plan-1",
      artifactPath: "/tmp/resume.pdf", manifestPath: "/tmp/resume.pdf.manifest.json", createdAt: new Date("2026-07-21T15:00:00Z")
    },
    outputPath: "/tmp/resume.pdf",
    manifestPath: "/tmp/resume.pdf.manifest.json",
    reused: false,
    selectedEvidenceCount: 12,
    ...overrides
  }
}

describe("documents resume CLI", () => {
  afterEach(() => { vi.restoreAllMocks(); process.exitCode = undefined })

  it("uses English/standard defaults and forwards model, language, and length overrides", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const execute = vi.fn(async (command: any) => ({ ...samplePlan(), language: command.language, length: command.length, model: command.model ?? "qwen" }))
    const services = { planResumeContent: { execute }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--no-progress"])
    expect(execute).toHaveBeenLastCalledWith({ jobDescriptionId: "job-1", language: "en", length: "standard" })
    await program(services).parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--language", "pt-BR", "--length", "detailed", "--model", "custom", "--no-progress"])
    expect(execute).toHaveBeenLastCalledWith({ jobDescriptionId: "job-1", language: "pt-BR", length: "detailed", model: "custom" })
    await program(services).parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--force", "--no-progress"])
    expect(execute).toHaveBeenLastCalledWith({ jobDescriptionId: "job-1", language: "en", length: "standard", force: true })
    expect(services.close).toHaveBeenCalledTimes(3)
  })

  it("prints one lossless JSON document with no preview text", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const services = { planResumeContent: { execute: vi.fn(async () => samplePlan()) }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--json"])
    expect(log).toHaveBeenCalledTimes(1)
    const output = String(log.mock.calls[0][0])
    expect(JSON.parse(output)).toMatchObject({ id: samplePlan().id, createdAt: "2026-07-20T15:00:00.000Z" })
    expect(output).not.toContain("Resume Content Plan (")
  })

  it("renders compact and verbose terminal views without prompts or provider responses", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const services = { planResumeContent: { execute: vi.fn(async () => samplePlan()) }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--verbose", "--no-progress"])
    const output = log.mock.calls.map(([value]) => String(value)).join("\n")
    expect(output).toContain("Built reliable TypeScript services")
    expect(output).toContain("Omitted ev-2")
    expect(output).toContain("Uncovered requirements: req-2")
    expect(output).toContain("Generation: ollama/qwen")
    expect(output).not.toContain("systemPrompt")
    expect(output).not.toContain("raw provider")
  })

  it("reports each long-running planning stage through terminal progress", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const progress = { start: vi.fn(), update: vi.fn(), succeed: vi.fn(), fail: vi.fn() }
    const execute = vi.fn(async (command: any) => {
      for (const stage of ["loading_evidence", "checking_existing_plan", "generating_content", "validating_content", "persisting_plan"] as const) {
        command.onProgress(stage)
      }
      return samplePlan()
    })
    const services = { planResumeContent: { execute }, close: vi.fn(async () => undefined) }

    await program(services, vi.fn(() => progress)).parseAsync(["node", "pke", "documents", "resume", "plan", "job-1"])

    expect(progress.start).toHaveBeenCalledWith("Preparing resume content planning")
    expect(progress.update.mock.calls.map(([message]) => message)).toEqual([
      "Loading the latest compatible Curated Evidence Pack",
      "Checking for an existing immutable Resume Content Plan",
      "Generating schema-bound resume content with the configured model",
      "Validating evidence grounding and factual preservation",
      "Persisting the immutable Resume Content Plan",
      "Flushing planning telemetry and closing resources"
    ])
    expect(progress.succeed).toHaveBeenCalledWith("Resume Content Plan ready (1 evidence item(s))")
    expect(progress.fail).not.toHaveBeenCalled()
  })

  it("rejects invalid option values before constructing services", async () => {
    const factory = vi.fn(() => ({ planResumeContent: { execute: vi.fn() }, close: vi.fn() }))
    const command = new Command().exitOverride()
    registerDocumentsCommands(command, factory as any)
    await expect(command.parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--language", "fr"])).rejects.toMatchObject({ code: "commander.invalidArgument" })
    expect(factory).not.toHaveBeenCalled()
  })

  it("reports actionable failures and exposes progress opt-out", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const services = { planResumeContent: { execute: vi.fn(async () => { throw new Error("No compatible persisted Curated Evidence Pack was found for job job-1. Run pke jobs reason job-1 first.") }) }, close: vi.fn(async () => undefined) }
    const command = program(services)
    await command.parseAsync(["node", "pke", "documents", "resume", "plan", "job-1", "--no-progress"])
    expect(error).toHaveBeenCalledWith(expect.stringContaining("pke jobs reason job-1"))
    expect(process.exitCode).toBe(1)
    const help = command.commands.find((item) => item.name() === "documents")?.commands.find((item) => item.name() === "resume")?.commands.find((item) => item.name() === "plan")?.helpInformation()
    expect(help).toContain("--no-progress")
    expect(help).toContain("disable interactive terminal progress")
  })

  it("uses PDF/English/standard/ATS defaults and forwards all generation overrides", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const execute = vi.fn(async (command: any) => sampleGenerationResult({ artifact: { ...sampleGenerationResult().artifact, format: command.format }, outputPath: command.outputPath ?? "/tmp/resume.pdf" }))
    const services = { generateResume: { execute }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--no-progress"])
    expect(execute).toHaveBeenLastCalledWith({ jobDescriptionId: "job-1", format: "pdf", language: "en", length: "standard", templateId: "ats-clean-v1" })
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--format", "html", "--language", "pt-BR", "--length", "detailed", "--template", "ats-clean-v1", "--output", "/tmp/custom.html", "--force", "--no-progress"])
    expect(execute).toHaveBeenLastCalledWith({ jobDescriptionId: "job-1", format: "html", language: "pt-BR", length: "detailed", templateId: "ats-clean-v1", outputPath: "/tmp/custom.html", force: true })
    expect(services.close).toHaveBeenCalledTimes(2)
  })

  it("prints concise human generation output and exactly one JSON result", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const services = { generateResume: { execute: vi.fn(async () => sampleGenerationResult()) }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--no-progress"])
    const human = log.mock.calls.map(([value]) => String(value)).join("\n")
    expect(human).toContain("✓ Resume generated")
    expect(human).toContain("format=pdf")
    expect(human).toContain("evidenceItems=12")
    expect(human).toContain("manifest=/tmp/resume.pdf.manifest.json")
    log.mockClear()
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--json"])
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ reused: false, artifact: { id: "artifact-1", createdAt: "2026-07-21T15:00:00.000Z" } })
  })

  it("reports long-running generation and Chromium/PDF stages through terminal progress", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const terminal = { start: vi.fn(), update: vi.fn(), succeed: vi.fn(), fail: vi.fn() }
    const execute = vi.fn(async (command: any) => {
      for (const stage of ["loading_plan", "loading_provenance", "loading_candidate", "validating_input", "checking_existing_artifact", "building_document", "rendering_pdf", "validating_artifact", "writing_output", "persisting_artifact"] as const) command.onProgress(stage)
      return sampleGenerationResult()
    })
    const services = { generateResume: { execute }, close: vi.fn(async () => undefined) }
    await program(services, vi.fn(() => terminal)).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1"])
    expect(terminal.start).toHaveBeenCalledWith("Preparing deterministic resume generation")
    expect(terminal.update.mock.calls.map(([message]) => message)).toContain("Launching local Chromium and rendering the selectable-text PDF")
    expect(terminal.update.mock.calls.map(([message]) => message)).toContain("Flushing generation telemetry and closing resources")
    expect(terminal.succeed).toHaveBeenCalledWith("Resume generated")
  })

  it("rejects invalid generation options before services and reports missing-plan guidance", async () => {
    const factory = vi.fn(() => ({ generateResume: { execute: vi.fn() }, close: vi.fn() }))
    const command = new Command().exitOverride()
    registerDocumentsCommands(command, factory as any)
    await expect(command.parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--format", "docx"])).rejects.toMatchObject({ code: "commander.invalidArgument" })
    await expect(command.parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--template", "fancy"])).rejects.toMatchObject({ code: "commander.invalidArgument" })
    expect(factory).not.toHaveBeenCalled()
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const services = { generateResume: { execute: vi.fn(async () => { throw new Error("No compatible Resume Content Plan was found. Run pke documents resume plan job-1 first.") }) }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--no-progress"])
    expect(error).toHaveBeenCalledWith(expect.stringContaining("documents resume plan job-1"))
    expect(process.exitCode).toBe(1)
  })

  it("prints distinct actionable generation issues in human and machine-readable modes", async () => {
    const validation = new ResumeGenerationValidationError([
      { code: "missing_candidate_name", path: "candidate.name", message: "Ingest a professional-profile/v1 document with an explicit Name." },
      { code: "missing_renderable_experience", path: "plan.plannedExperiences", message: "Correct or regenerate the Resume Content Plan." }
    ])
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const services = { generateResume: { execute: vi.fn(async () => { throw validation }) }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--no-progress"])
    expect(String(error.mock.calls[0][0])).toContain("missing_candidate_name candidate.name")
    expect(String(error.mock.calls[0][0])).toContain("missing_renderable_experience plan.plannedExperiences")

    error.mockClear()
    process.exitCode = undefined
    await program(services).parseAsync(["node", "pke", "documents", "resume", "generate", "job-1", "--json"])
    expect(error).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(error.mock.calls[0][0]))).toMatchObject({ error: { name: "ResumeGenerationValidationError", issues: [{ code: "missing_candidate_name" }, { code: "missing_renderable_experience" }] } })
  })
})
