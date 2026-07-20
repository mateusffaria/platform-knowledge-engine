import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Command } from "commander"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EvaluationRun } from "../src/modules/evaluation/domain/model.js"
import { registerEvaluationCommands } from "../src/modules/evaluation/interfaces/cli/evaluation-command.js"

function sampleRun(status: EvaluationRun["status"] = "passed"): EvaluationRun {
  const na = { status: "not_applicable" as const }
  return { reportSchemaVersion: "evaluation-report-v1", id: "run-1", status, startedAt: new Date(0), completedAt: new Date(1), versions: { datasetId: "golden", datasetVersion: "1", datasetHash: "hash", gitSha: "sha", candidatePackVersions: ["pack"] }, results: [{ scenarioId: "exact", stage: "retrieval", status: status === "passed" ? "passed" : "failed", metadata: { durationMs: 1 }, assertions: status === "passed" ? [] : [{ expectationId: "expected", stage: "retrieval", type: "expected_evidence_ids", passed: false, reasonCode: "expected_evidence_missing" }] }], qualityMetrics: { evidencePrecisionAtK: na, evidenceRecallAtK: na, requirementCoverageAccuracy: na, missingEvidenceAccuracy: na, unsupportedSelectionRate: na, provenanceCompleteness: na, schemaValidationSuccessRate: na }, performanceMetrics: {} }
}

function program(services: any): Command {
  const command = new Command()
  command.exitOverride()
  registerEvaluationCommands(command, () => services)
  return command
}

describe("evaluation CLI", () => {
  afterEach(() => { vi.restoreAllMocks(); process.exitCode = undefined })

  it("lists all scenario families without constructing services until execution", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const close = vi.fn(async () => undefined)
    const services = { listEvaluationScenarios: { execute: vi.fn(async () => ({ datasetId: "golden", datasetVersion: "1", datasetHash: "hash", scenarios: ["exact", "leadership", "missing", "empty", "redundant", "trust"].map((id) => ({ id, description: id })) })) }, runEvaluation: { execute: vi.fn() }, showEvaluationRun: { execute: vi.fn() }, close }
    const command = program(services)
    expect(services.listEvaluationScenarios.execute).not.toHaveBeenCalled()
    await command.parseAsync(["node", "pke", "eval", "list"])
    expect(log.mock.calls.map(([value]) => value).join("\n")).toContain("trust: trust")
    expect(close).toHaveBeenCalled()
  })

  it("runs full and scoped evaluations, reports failures, and renders historical runs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const runEvaluation = { execute: vi.fn(async () => sampleRun("failed")) }
    const services = { listEvaluationScenarios: { execute: vi.fn() }, runEvaluation, showEvaluationRun: { execute: vi.fn(async () => sampleRun()) }, close: vi.fn(async () => undefined) }
    await program(services).parseAsync(["node", "pke", "eval", "run", "exact"])
    expect(runEvaluation.execute).toHaveBeenCalledWith({ scenarioId: "exact" })
    expect(log.mock.calls.map(([value]) => value).join("\n")).toContain("exact [retrieval] failed")
    expect(process.exitCode).toBe(1)
    process.exitCode = undefined
    await program(services).parseAsync(["node", "pke", "eval", "show", "run-1", "--format", "markdown"])
    expect(log.mock.calls.map(([value]) => value).join("\n")).toContain("# Evaluation Run run-1")
  })

  it("offers opt-out progress feedback for long-running evaluation runs", () => {
    const command = program({ listEvaluationScenarios: { execute: vi.fn() }, runEvaluation: { execute: vi.fn() }, showEvaluationRun: { execute: vi.fn() }, close: vi.fn() })
    const help = command.commands.find((item) => item.name() === "eval")?.commands.find((item) => item.name() === "run")?.helpInformation()
    expect(help).toContain("--no-progress")
    expect(help).toContain("disable interactive terminal progress")
  })

  it("exports lossless JSON and Markdown without overwriting files", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const services = { listEvaluationScenarios: { execute: vi.fn() }, runEvaluation: { execute: vi.fn(async () => sampleRun()) }, showEvaluationRun: { execute: vi.fn() }, close: vi.fn(async () => undefined) }
    const directory = await mkdtemp(join(tmpdir(), "pke-eval-cli-"))
    const json = join(directory, "report.json")
    await program(services).parseAsync(["node", "pke", "eval", "run", "--format", "json", "--output", json])
    expect(JSON.parse(await readFile(json, "utf8")).run.id).toBe("run-1")
    await program(services).parseAsync(["node", "pke", "eval", "run", "--format", "markdown", "--output", json])
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Refusing to overwrite"))
    expect(process.exitCode).toBe(1)
  })

  it("reports unknown scenarios and repository failures without breaking unrelated command construction", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const services = { listEvaluationScenarios: { execute: vi.fn() }, runEvaluation: { execute: vi.fn(async () => { throw new Error("Unknown evaluation scenario unknown. Available scenarios: exact") }) }, showEvaluationRun: { execute: vi.fn(async () => { throw new Error("Evaluation run missing was not found.") }) }, close: vi.fn(async () => undefined) }
    const command = program(services)
    command.command("unrelated").action(() => undefined)
    await command.parseAsync(["node", "pke", "unrelated"])
    expect(process.exitCode).toBeUndefined()
    await command.parseAsync(["node", "pke", "eval", "run", "unknown"])
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Available scenarios"))
    expect(process.exitCode).toBe(1)
  })
})
