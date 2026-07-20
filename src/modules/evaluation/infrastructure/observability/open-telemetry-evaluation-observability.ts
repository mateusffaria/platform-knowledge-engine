import { Logger, logEvent } from "../../../../shared/logging/logger.js"
import { Telemetry } from "../../../../shared/observability/tracing.js"
import { EvaluationObservability, EvaluationTrace } from "../../application/ports/evaluation-observability.js"
import { EvaluationAssertionResult, EvaluationMetricValue, EvaluationRun, EvaluationStageExecution } from "../../domain/model.js"

function value(metric: EvaluationMetricValue): number | undefined { return metric.status === "value" ? metric.value : undefined }

export class OpenTelemetryEvaluationObservability implements EvaluationObservability {
  constructor(private readonly telemetry: Telemetry, private readonly logger: Logger) {}

  trace(metadata: Record<string, string | undefined>): EvaluationTrace {
    const stages: Array<{ scenarioId: string; execution: EvaluationStageExecution }> = []
    const assertions: Array<{ scenarioId: string; result: EvaluationAssertionResult }> = []
    return {
      stage: async (scenarioId, execution) => {
        stages.push({ scenarioId, execution })
        const attributes = { dataset_version: metadata.dataset_version, stage: execution.stage, provider: execution.metadata.provider, model: execution.metadata.model, prompt_version: execution.metadata.promptVersion, outcome: execution.error?.code ?? "completed" }
        this.telemetry.countEvaluation("stage", attributes)
        this.telemetry.recordEvaluation("stageDuration", execution.metadata.durationMs, attributes)
      },
      assertion: async (scenarioId, result) => {
        assertions.push({ scenarioId, result })
        this.telemetry.countEvaluation("assertion", { dataset_version: metadata.dataset_version, stage: result.stage, outcome: result.passed ? "passed" : "failed" })
      },
      complete: async (run) => {
        const bounded = { dataset_version: run.versions.datasetVersion, provider: run.versions.provider, model: run.versions.model, prompt_version: run.versions.promptVersion, outcome: run.status }
        this.telemetry.countEvaluation("run", bounded)
        const quality = run.qualityMetrics
        for (const [name, metric] of Object.entries({ evidencePrecisionAtK: quality.evidencePrecisionAtK, evidenceRecallAtK: quality.evidenceRecallAtK, requirementCoverageAccuracy: quality.requirementCoverageAccuracy, missingEvidenceAccuracy: quality.missingEvidenceAccuracy, unsupportedSelectionRate: quality.unsupportedSelectionRate, provenanceCompleteness: quality.provenanceCompleteness, schemaValidationSuccessRate: quality.schemaValidationSuccessRate }) as Array<[keyof typeof quality, EvaluationMetricValue]>) {
          const observed = value(metric)
          if (observed !== undefined) this.telemetry.recordEvaluation(name, observed, bounded)
        }
        if (run.performanceMetrics.averageReasoningLatencyMs !== undefined) this.telemetry.recordEvaluation("reasoningLatency", run.performanceMetrics.averageReasoningLatencyMs, bounded)
        if (run.performanceMetrics.promptTokens) this.telemetry.recordEvaluation("promptTokens", run.performanceMetrics.promptTokens.total, bounded)
        if (run.performanceMetrics.completionTokens) this.telemetry.recordEvaluation("completionTokens", run.performanceMetrics.completionTokens.total, bounded)
        logEvent(this.logger, "evaluation.run.completed", {
          run_id: run.id,
          dataset_id: run.versions.datasetId,
          dataset_version: run.versions.datasetVersion,
          dataset_hash: run.versions.datasetHash,
          git_sha: run.versions.gitSha,
          requested_scenario_id: run.requestedScenarioId,
          outcome: run.status,
          provider: run.versions.provider,
          model: run.versions.model,
          prompt_version: run.versions.promptVersion,
          candidate_pack_versions: run.versions.candidatePackVersions.join(","),
          stage_count: stages.length,
          stage_failed_count: stages.filter((item) => item.execution.error).length,
          assertion_count: assertions.length,
          assertion_failed_count: assertions.filter((item) => !item.result.passed).length,
          duration_ms: run.completedAt.getTime() - run.startedAt.getTime(),
          evidence_precision_at_k: value(quality.evidencePrecisionAtK),
          evidence_recall_at_k: value(quality.evidenceRecallAtK),
          requirement_coverage_accuracy: value(quality.requirementCoverageAccuracy),
          missing_evidence_accuracy: value(quality.missingEvidenceAccuracy),
          unsupported_selection_rate: value(quality.unsupportedSelectionRate),
          provenance_completeness: value(quality.provenanceCompleteness),
          schema_validation_success_rate: value(quality.schemaValidationSuccessRate),
          average_reasoning_latency_ms: run.performanceMetrics.averageReasoningLatencyMs,
          prompt_tokens: run.performanceMetrics.promptTokens?.total,
          completion_tokens: run.performanceMetrics.completionTokens?.total
        }, run.status === "errored" ? "error" : "info")
      },
      flush: async () => undefined
    }
  }
}
