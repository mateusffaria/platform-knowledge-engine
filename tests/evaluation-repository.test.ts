import { describe, expect, it } from "vitest"

import { EvaluationRun } from "../src/modules/evaluation/domain/model.js"
import { DrizzleEvaluationRepository } from "../src/modules/evaluation/infrastructure/repositories/drizzle-evaluation-repository.js"
import { evaluationResults, evaluationRuns } from "../src/shared/database/schema.js"

function run(): EvaluationRun {
  const na = { status: "not_applicable" as const }
  return {
    reportSchemaVersion: "evaluation-report-v1", id: "00000000-0000-4000-8000-000000000001", status: "passed", requestedScenarioId: "scenario",
    startedAt: new Date("2026-07-20T10:00:00Z"), completedAt: new Date("2026-07-20T10:00:01Z"),
    versions: { datasetId: "golden", datasetVersion: "1", datasetHash: "hash", gitSha: "sha", provider: "fixture", model: "model", promptVersion: "prompt", candidatePackVersions: ["pack-v1"] },
    results: [{ scenarioId: "scenario", stage: "reasoning", status: "passed", assertions: [], metadata: { durationMs: 2, candidatePackVersion: "pack-v1" }, observation: { evidence: [], candidateEvidenceIdsByRequirement: {}, coverage: [], schemaValid: true } }],
    qualityMetrics: { evidencePrecisionAtK: na, evidenceRecallAtK: na, requirementCoverageAccuracy: na, missingEvidenceAccuracy: na, unsupportedSelectionRate: na, provenanceCompleteness: na, schemaValidationSuccessRate: na },
    performanceMetrics: { averageReasoningLatencyMs: 2 }
  }
}

describe("DrizzleEvaluationRepository", () => {
  it("persists run metadata and results atomically and loads the immutable snapshot", async () => {
    let runRow: any
    let resultRows: any[] = []
    const database: any = {
      transaction: async (operation: (transaction: any) => Promise<void>) => operation(database),
      insert: (table: any) => ({ values: async (values: any) => {
        if (table === evaluationRuns) runRow = {
          ...values,
          requestedScenarioId: values.requestedScenarioId ?? null,
          provider: values.provider ?? null,
          model: values.model ?? null,
          promptVersion: values.promptVersion ?? null
        }
        else resultRows = (Array.isArray(values) ? values : [values]).map((value) => ({ ...value, observation: value.observation ?? null, diagnostic: value.diagnostic ?? null }))
      } }),
      select: () => ({ from: (table: any) => ({
        where: () => table === evaluationRuns
          ? { limit: async () => runRow ? [runRow] : [] }
          : Promise.resolve(resultRows)
      }) })
    }
    const repository = new DrizzleEvaluationRepository(database)
    const input = run()
    await repository.save(input)
    const loaded = await repository.findById(input.id)

    expect(loaded).toEqual(input)
    expect(runRow).toMatchObject({ datasetVersion: "1", datasetHash: "hash", gitSha: "sha", candidatePackVersions: ["pack-v1"] })
    expect(resultRows).toHaveLength(1)
  })
})
