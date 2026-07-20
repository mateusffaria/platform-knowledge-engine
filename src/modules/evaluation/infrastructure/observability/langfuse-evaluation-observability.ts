import { LangfuseClient } from "../../../../shared/observability/langfuse.js"
import { EvaluationObservability, EvaluationTrace } from "../../application/ports/evaluation-observability.js"

export class LangfuseEvaluationObservability implements EvaluationObservability {
  constructor(private readonly client: LangfuseClient) {}

  trace(metadata: Record<string, string | undefined>): EvaluationTrace {
    const trace = this.client.trace("evaluation-run", metadata)
    return {
      stage: async (scenarioId, execution) => trace.event("evaluation_stage_completed", {
        scenarioId,
        stage: execution.stage,
        outcome: execution.error?.code ?? "completed",
        durationMs: execution.metadata.durationMs,
        provider: execution.metadata.provider,
        model: execution.metadata.model,
        promptVersion: execution.metadata.promptVersion,
        candidatePackVersion: execution.metadata.candidatePackVersion
      }),
      assertion: async (scenarioId, result) => trace.event("evaluation_assertion_completed", {
        scenarioId,
        stage: result.stage,
        expectationId: result.expectationId,
        expectationType: result.type,
        outcome: result.passed ? "passed" : "failed",
        reasonCode: result.reasonCode
      }),
      complete: async (run) => trace.event("evaluation_run_completed", {
        runId: run.id,
        outcome: run.status,
        datasetId: run.versions.datasetId,
        datasetVersion: run.versions.datasetVersion,
        datasetHash: run.versions.datasetHash,
        gitSha: run.versions.gitSha,
        provider: run.versions.provider,
        model: run.versions.model,
        promptVersion: run.versions.promptVersion,
        candidatePackVersions: run.versions.candidatePackVersions,
        qualityMetrics: run.qualityMetrics,
        performanceMetrics: run.performanceMetrics
      }),
      flush: () => trace.flush()
    }
  }
}
