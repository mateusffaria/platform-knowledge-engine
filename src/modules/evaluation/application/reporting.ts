import { EvaluationMetricValue, EvaluationReport, EvaluationRun, EvaluationStageStatus } from "../domain/model.js"

export type EvaluationReportFormat = "cli" | "json" | "markdown"

export function buildEvaluationReport(run: EvaluationRun): EvaluationReport {
  const counts: Record<EvaluationStageStatus, number> = { passed: 0, failed: 0, errored: 0, blocked: 0 }
  for (const result of run.results) counts[result.status] += 1
  return { run, counts }
}

function metricText(value: EvaluationMetricValue): string {
  return value.status === "not_applicable" ? "n/a" : `${(value.value * 100).toFixed(1)}% (${value.numerator}/${value.denominator})`
}

export function renderConciseReport(report: EvaluationReport): string {
  const { run, counts } = report
  const lines = [
    `Evaluation run ${run.id}: ${run.status.toUpperCase()}`,
    `Dataset ${run.versions.datasetId}@${run.versions.datasetVersion} git=${run.versions.gitSha}`,
    `Stages passed=${counts.passed} failed=${counts.failed} errored=${counts.errored} blocked=${counts.blocked}`,
    `Quality precision@K=${metricText(run.qualityMetrics.evidencePrecisionAtK)} recall@K=${metricText(run.qualityMetrics.evidenceRecallAtK)} coverage=${metricText(run.qualityMetrics.requirementCoverageAccuracy)} missing=${metricText(run.qualityMetrics.missingEvidenceAccuracy)}`,
    `Quality unsupported=${metricText(run.qualityMetrics.unsupportedSelectionRate)} provenance=${metricText(run.qualityMetrics.provenanceCompleteness)} schema=${metricText(run.qualityMetrics.schemaValidationSuccessRate)}`,
    `Performance reasoning_latency_ms=${run.performanceMetrics.averageReasoningLatencyMs?.toFixed(1) ?? "n/a"} prompt_tokens=${run.performanceMetrics.promptTokens?.total ?? "n/a"} completion_tokens=${run.performanceMetrics.completionTokens?.total ?? "n/a"}`
  ]
  for (const result of run.results.filter((item) => item.status !== "passed")) {
    lines.push(`${result.scenarioId} [${result.stage}] ${result.status}`)
    if (result.diagnostic) lines.push(`  ${result.diagnostic.code}: ${result.diagnostic.message}`)
    for (const assertion of result.assertions.filter((item) => !item.passed)) lines.push(`  ${assertion.expectationId}: ${assertion.reasonCode}`)
  }
  return lines.join("\n")
}

export function renderMarkdownReport(report: EvaluationReport): string {
  const { run, counts } = report
  const lines = [
    `# Evaluation Run ${run.id}`,
    "",
    `Status: **${run.status}**`,
    "",
    `Dataset: \`${run.versions.datasetId}@${run.versions.datasetVersion}\`  `,
    `Dataset hash: \`${run.versions.datasetHash}\`  `,
    `Git SHA: \`${run.versions.gitSha}\``,
    "",
    "## Stage Summary",
    "",
    "| Passed | Failed | Errored | Blocked |",
    "| ---: | ---: | ---: | ---: |",
    `| ${counts.passed} | ${counts.failed} | ${counts.errored} | ${counts.blocked} |`,
    "",
    "## Quality Metrics",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Evidence precision@K | ${metricText(run.qualityMetrics.evidencePrecisionAtK)} |`,
    `| Evidence recall@K | ${metricText(run.qualityMetrics.evidenceRecallAtK)} |`,
    `| Requirement coverage accuracy | ${metricText(run.qualityMetrics.requirementCoverageAccuracy)} |`,
    `| Missing-evidence accuracy | ${metricText(run.qualityMetrics.missingEvidenceAccuracy)} |`,
    `| Unsupported-selection rate | ${metricText(run.qualityMetrics.unsupportedSelectionRate)} |`,
    `| Provenance completeness | ${metricText(run.qualityMetrics.provenanceCompleteness)} |`,
    `| Schema-validation success | ${metricText(run.qualityMetrics.schemaValidationSuccessRate)} |`,
    "",
    "## Scenario Stages",
    "",
    "| Scenario | Stage | Status | Assertions |",
    "| --- | --- | --- | ---: |"
  ]
  for (const result of run.results) {
    lines.push(`| ${result.scenarioId} | ${result.stage} | ${result.status} | ${result.assertions.filter((item) => item.passed).length}/${result.assertions.length} |`)
    for (const assertion of result.assertions.filter((item) => !item.passed)) {
      lines.push(`\n- \`${result.scenarioId}/${result.stage}/${assertion.expectationId}\`: \`${assertion.reasonCode}\`; expected \`${JSON.stringify(assertion.expected)}\`, observed \`${JSON.stringify(assertion.observed)}\``)
    }
  }
  return `${lines.join("\n")}\n`
}

export function renderEvaluationReport(run: EvaluationRun, format: EvaluationReportFormat): string {
  const report = buildEvaluationReport(run)
  if (format === "json") return JSON.stringify(report, null, 2)
  if (format === "markdown") return renderMarkdownReport(report)
  return renderConciseReport(report)
}
