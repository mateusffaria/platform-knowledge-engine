import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"

import { evaluationResults, evaluationRuns } from "../../../../shared/database/schema.js"
import { EvaluationRepository } from "../../application/ports/evaluation-repository.js"
import { EvaluationResult, EvaluationRun } from "../../domain/model.js"

interface EvaluationDatabase {
  select: (...args: any[]) => any
  insert: (...args: any[]) => any
  transaction: <T>(operation: (transaction: EvaluationDatabase) => Promise<T>) => Promise<T>
}

function toResult(row: typeof evaluationResults.$inferSelect): EvaluationResult {
  return {
    scenarioId: row.scenarioId,
    stage: row.stage as EvaluationResult["stage"],
    status: row.status as EvaluationResult["status"],
    assertions: row.assertions as unknown as EvaluationResult["assertions"],
    metadata: row.metadata as unknown as EvaluationResult["metadata"],
    observation: row.observation === null ? undefined : row.observation as unknown as EvaluationResult["observation"],
    diagnostic: row.diagnostic === null ? undefined : row.diagnostic as unknown as EvaluationResult["diagnostic"]
  }
}

function toRun(row: typeof evaluationRuns.$inferSelect, resultRows: Array<typeof evaluationResults.$inferSelect>): EvaluationRun {
  return {
    reportSchemaVersion: row.reportSchemaVersion,
    id: row.id,
    status: row.status as EvaluationRun["status"],
    requestedScenarioId: row.requestedScenarioId ?? undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    versions: {
      datasetId: row.datasetId,
      datasetVersion: row.datasetVersion,
      datasetHash: row.datasetHash,
      gitSha: row.gitSha,
      provider: row.provider ?? undefined,
      model: row.model ?? undefined,
      promptVersion: row.promptVersion ?? undefined,
      candidatePackVersions: row.candidatePackVersions
    },
    results: resultRows.map(toResult),
    qualityMetrics: row.qualityMetrics as unknown as EvaluationRun["qualityMetrics"],
    performanceMetrics: row.performanceMetrics as unknown as EvaluationRun["performanceMetrics"]
  }
}

export class DrizzleEvaluationRepository implements EvaluationRepository {
  constructor(private readonly db: EvaluationDatabase) {}

  async save(run: EvaluationRun): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(evaluationRuns).values({
        id: run.id,
        datasetId: run.versions.datasetId,
        datasetVersion: run.versions.datasetVersion,
        datasetHash: run.versions.datasetHash,
        requestedScenarioId: run.requestedScenarioId,
        gitSha: run.versions.gitSha,
        provider: run.versions.provider,
        model: run.versions.model,
        promptVersion: run.versions.promptVersion,
        candidatePackVersions: run.versions.candidatePackVersions,
        status: run.status,
        reportSchemaVersion: run.reportSchemaVersion,
        qualityMetrics: run.qualityMetrics,
        performanceMetrics: run.performanceMetrics,
        startedAt: run.startedAt,
        completedAt: run.completedAt
      })
      if (run.results.length > 0) {
        await transaction.insert(evaluationResults).values(run.results.map((result) => ({
          id: randomUUID(),
          runId: run.id,
          scenarioId: result.scenarioId,
          stage: result.stage,
          status: result.status,
          assertions: result.assertions,
          metadata: result.metadata,
          observation: result.observation,
          diagnostic: result.diagnostic
        })))
      }
    })
  }

  async findById(runId: string): Promise<EvaluationRun | undefined> {
    const rows = await this.db.select().from(evaluationRuns).where(eq(evaluationRuns.id, runId)).limit(1)
    if (!rows[0]) return undefined
    const resultRows = await this.db.select().from(evaluationResults).where(eq(evaluationResults.runId, runId))
    return toRun(rows[0], resultRows)
  }
}
