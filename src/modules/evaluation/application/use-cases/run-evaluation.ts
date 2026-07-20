import { assertStage } from "../assertions.js"
import { aggregatePerformanceMetrics, aggregateQualityMetrics } from "../metrics.js"
import { EvaluationDatasetLoader } from "../ports/dataset-loader.js"
import { EvaluationObservability, NoopEvaluationObservability } from "../ports/evaluation-observability.js"
import { EvaluationPipeline } from "../ports/evaluation-pipeline.js"
import { EvaluationRepository } from "../ports/evaluation-repository.js"
import { EvaluationRuntimeMetadata } from "../ports/runtime-metadata.js"
import { EvaluationResult, EvaluationRun, EvaluationStageExecution } from "../../domain/model.js"

export const evaluationReportSchemaVersion = "evaluation-report-v1"

export interface RunEvaluationDependencies {
  datasetLoader: EvaluationDatasetLoader
  pipeline: EvaluationPipeline
  repository: EvaluationRepository
  runtime: EvaluationRuntimeMetadata
  observability?: EvaluationObservability
}

function resultFromExecution(scenarioId: string, scenario: Parameters<typeof assertStage>[0], execution: EvaluationStageExecution): EvaluationResult {
  if (execution.error) {
    return {
      scenarioId,
      stage: execution.stage,
      status: execution.error.code === "blocked" ? "blocked" : "errored",
      assertions: [],
      metadata: execution.metadata,
      diagnostic: execution.error
    }
  }
  if (!execution.observation) {
    return { scenarioId, stage: execution.stage, status: "errored", assertions: [], metadata: execution.metadata, diagnostic: { code: "missing_observation", message: "Pipeline stage returned no observation." } }
  }
  const assertions = assertStage(scenario, execution.stage, execution.observation)
  return {
    scenarioId,
    stage: execution.stage,
    status: assertions.some((assertion) => !assertion.passed) ? "failed" : "passed",
    assertions,
    metadata: execution.metadata,
    observation: execution.observation
  }
}

async function ignoreObservability(operation: () => Promise<void>): Promise<void> {
  try { await operation() } catch {}
}

export function createRunEvaluationUseCase(dependencies: RunEvaluationDependencies) {
  return {
    async execute(command: { scenarioId?: string } = {}): Promise<EvaluationRun> {
      const dataset = await dependencies.datasetLoader.load()
      const scenarios = command.scenarioId
        ? dataset.scenarios.filter((scenario) => scenario.id === command.scenarioId)
        : dataset.scenarios
      if (command.scenarioId && scenarios.length === 0) {
        throw new Error(`Unknown evaluation scenario ${command.scenarioId}. Available scenarios: ${dataset.scenarios.map((scenario) => scenario.id).join(", ")}`)
      }
      const startedAt = dependencies.runtime.now()
      const trace = (dependencies.observability ?? new NoopEvaluationObservability()).trace({
        dataset_id: dataset.id,
        dataset_version: dataset.version,
        dataset_hash: dataset.hash,
        git_sha: dependencies.runtime.gitSha(),
        scenario_id: command.scenarioId
      })
      const results: EvaluationResult[] = []
      for (const scenario of scenarios) {
        let executions: EvaluationStageExecution[]
        try {
          executions = await dependencies.pipeline.execute(scenario)
        } catch (error) {
          executions = [{ stage: "retrieval", metadata: { durationMs: 0 }, error: { code: "pipeline_error", message: error instanceof Error ? error.message : "Evaluation pipeline failed." } }]
        }
        for (const execution of executions) {
          await ignoreObservability(() => trace.stage(scenario.id, execution))
          const result = resultFromExecution(scenario.id, scenario, execution)
          results.push(result)
          for (const assertion of result.assertions) await ignoreObservability(() => trace.assertion(scenario.id, assertion))
        }
      }
      const hasError = results.some((result) => result.status === "errored" || result.status === "blocked")
      const hasFailure = results.some((result) => result.status === "failed")
      const reasoningMetadata = results.find((result) => result.stage === "reasoning" && result.metadata.provider)?.metadata
      const run: EvaluationRun = {
        reportSchemaVersion: evaluationReportSchemaVersion,
        id: dependencies.runtime.nextId(),
        status: hasError ? "errored" : hasFailure ? "failed" : "passed",
        requestedScenarioId: command.scenarioId,
        startedAt,
        completedAt: dependencies.runtime.now(),
        versions: {
          datasetId: dataset.id,
          datasetVersion: dataset.version,
          datasetHash: dataset.hash,
          gitSha: dependencies.runtime.gitSha(),
          provider: reasoningMetadata?.provider,
          model: reasoningMetadata?.model,
          promptVersion: reasoningMetadata?.promptVersion,
          candidatePackVersions: [...new Set(results.flatMap((result) => result.metadata.candidatePackVersion ? [result.metadata.candidatePackVersion] : []))].sort()
        },
        results,
        qualityMetrics: aggregateQualityMetrics(scenarios, results),
        performanceMetrics: aggregatePerformanceMetrics(results)
      }
      await dependencies.repository.save(run)
      await ignoreObservability(() => trace.complete(run))
      await ignoreObservability(() => trace.flush())
      return run
    }
  }
}
