import { Command } from "commander"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { registerDocumentsCommands } from "../src/modules/documents/interfaces/cli/documents-command.js"

function samplePlan(): ResumeContentPlan {
  return {
    id: "00000000-0000-4000-8000-000000000001", planIdentity: "a".repeat(64), schemaVersion: "resume-content-plan/v1",
    jobDescriptionId: "job-1", curatedEvidencePackId: "pack-1", language: "en", length: "standard",
    professionalSummary: { text: "Built reliable TypeScript services.", supportingEvidenceIds: ["ev-1"] },
    plannedExperiences: [{ sourceExperienceId: "exp-1", organization: "Acme", role: "Engineer", bullets: [{ text: "Improved API latency by 35%.", supportingEvidenceIds: ["ev-1"], targetRequirementIds: ["req-1"], sourceOrganizationOrExperienceId: "exp-1", exaggerationRisk: "low", warnings: [] }] }],
    plannedSkillGroups: [{ name: "Languages", skills: ["TypeScript"], supportingEvidenceIds: ["ev-1"] }], selectedEvidenceIds: ["ev-1"],
    omittedEvidence: [{ evidenceId: "ev-2", reason: "length", explanation: "Concise bound" }], uncoveredRequirementIds: ["req-2"], warnings: ["Missing Kubernetes"],
    provider: "ollama", model: "qwen", promptVersion: "resume-planning/v1", createdAt: new Date("2026-07-20T15:00:00Z")
  }
}

function program(services: any, createProgress?: Parameters<typeof registerDocumentsCommands>[2]): Command {
  const command = new Command()
  command.exitOverride()
  registerDocumentsCommands(command, () => services, createProgress)
  return command
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
})
