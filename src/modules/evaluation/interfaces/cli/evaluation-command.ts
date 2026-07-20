import { writeFile } from "node:fs/promises"
import { Command } from "commander"

import { EvaluationReportFormat, renderEvaluationReport } from "../../application/reporting.js"
import { EvaluationRun } from "../../domain/model.js"
import { createProductionEvaluationServices } from "../../infrastructure/evaluation-runner.js"
import { createTerminalProgress } from "../../../../shared/cli/terminal-progress.js"

export type EvaluationServicesFactory = typeof createProductionEvaluationServices

function parseFormat(value: string): EvaluationReportFormat {
  if (value === "cli" || value === "json" || value === "markdown") return value
  throw new Error("Evaluation report format must be cli, json, or markdown.")
}

async function prepareReportOutput(run: EvaluationRun, options: { format: string; output?: string }): Promise<string> {
  const rendered = renderEvaluationReport(run, parseFormat(options.format))
  if (options.output) {
    try {
      await writeFile(options.output, `${rendered}${rendered.endsWith("\n") ? "" : "\n"}`, { encoding: "utf8", flag: "wx" })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") throw new Error(`Refusing to overwrite existing report: ${options.output}`)
      throw error
    }
    return `Evaluation report written to ${options.output}`
  }
  return rendered
}

function reportError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

export function registerEvaluationCommands(program: Command, createServices: EvaluationServicesFactory = createProductionEvaluationServices): void {
  const evaluation = program.command("eval").description("Run deterministic evidence retrieval and reasoning evaluations")

  evaluation.command("list")
    .description("List versioned golden evaluation scenarios")
    .option("--json", "print machine-readable JSON")
    .action(async (options: { json?: boolean }) => {
      let services: ReturnType<EvaluationServicesFactory> | undefined
      try {
        services = createServices()
        const result = await services.listEvaluationScenarios.execute()
        if (options.json) console.log(JSON.stringify(result, null, 2))
        else {
          console.log(`Dataset ${result.datasetId}@${result.datasetVersion}`)
          for (const scenario of result.scenarios) console.log(`${scenario.id}: ${scenario.description}`)
        }
      } catch (error) { reportError(error) } finally { await services?.close() }
    })

  evaluation.command("run")
    .description("Run all golden scenarios or one scenario")
    .argument("[scenario-id]", "stable scenario ID")
    .option("--format <format>", "report format: cli, json, or markdown", "cli")
    .option("--output <path>", "write a new report file instead of stdout")
    .option("--no-progress", "disable interactive terminal progress")
    .action(async (scenarioId: string | undefined, options: { format: string; output?: string; progress?: boolean }) => {
      const progress = createTerminalProgress({ enabled: options.format === "cli" && options.progress !== false })
      let services: ReturnType<EvaluationServicesFactory> | undefined
      try {
        progress.start("Loading the evaluation dataset and runtime")
        services = createServices()
        progress.update(scenarioId ? `Running golden scenario ${scenarioId}` : "Running all golden evaluation scenarios")
        const run = await services.runEvaluation.execute({ scenarioId })
        progress.update("Preparing and storing the evaluation report")
        const output = await prepareReportOutput(run, options)
        progress.update("Flushing evaluation telemetry and closing resources")
        const closingServices = services
        services = undefined
        await closingServices.close()
        if (run.status === "passed") progress.succeed(`Evaluation complete: ${run.results.length} stage result(s) passed`)
        else progress.fail(`Evaluation complete with status ${run.status}`)
        console.log(output)
        if (run.status !== "passed") process.exitCode = 1
      } catch (error) {
        progress.fail("Evaluation failed")
        reportError(error)
      } finally { await services?.close() }
    })

  evaluation.command("show")
    .description("Render a persisted evaluation run without rerunning it")
    .argument("<run-id>", "evaluation run ID")
    .option("--format <format>", "report format: cli, json, or markdown", "cli")
    .option("--output <path>", "write a new report file instead of stdout")
    .action(async (runId: string, options: { format: string; output?: string }) => {
      let services: ReturnType<EvaluationServicesFactory> | undefined
      try {
        services = createServices()
        console.log(await prepareReportOutput(await services.showEvaluationRun.execute(runId), options))
      } catch (error) { reportError(error) } finally { await services?.close() }
    })
}
