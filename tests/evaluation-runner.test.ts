import { describe, expect, it } from "vitest"

import { createRunEvaluationUseCase } from "../src/modules/evaluation/application/use-cases/run-evaluation.js"
import { EvaluationObservability, EvaluationTrace } from "../src/modules/evaluation/application/ports/evaluation-observability.js"
import { EvaluationPipeline } from "../src/modules/evaluation/application/ports/evaluation-pipeline.js"
import { EvaluationScenario } from "../src/modules/evaluation/domain/model.js"
import { FileEvaluationDatasetLoader } from "../src/modules/evaluation/infrastructure/datasets/file-evaluation-dataset-loader.js"
import { FixtureEvaluationPipeline } from "../src/modules/evaluation/infrastructure/pipeline/fixture-evaluation-pipeline.js"
import { InMemoryEvaluationRepository } from "../src/modules/evaluation/infrastructure/repositories/in-memory-evaluation-repository.js"

const runtime = {
  now: () => new Date("2026-07-20T12:00:00.000Z"),
  nextId: () => "run-1",
  gitSha: () => "git-sha"
}

describe("evaluation runner", () => {
  it("runs every golden scenario and records independent passing stages and versions", async () => {
    const repository = new InMemoryEvaluationRepository()
    const run = await createRunEvaluationUseCase({ datasetLoader: new FileEvaluationDatasetLoader(), pipeline: new FixtureEvaluationPipeline(undefined, () => 0), repository, runtime }).execute()

    expect(run.status).toBe("passed")
    expect(new Set(run.results.map((result) => result.scenarioId)).size).toBe(21)
    expect(run.results.every((result) => result.status === "passed")).toBe(true)
    expect(run.versions).toMatchObject({ datasetVersion: "1.1.0", gitSha: "git-sha", provider: "fixture", model: "golden-reasoner-v1", promptVersion: "evidence-reasoner-v1" })
    expect(run.versions.candidatePackVersions).toEqual(["candidate-evidence-pack-v5"])
    expect(await repository.findById("run-1")).toEqual(run)
  })

  it("runs one scenario and distinguishes assertion failures from execution errors and blocked stages", async () => {
    const dataset = await new FileEvaluationDatasetLoader().load()
    const failingPipeline: EvaluationPipeline = {
      execute: async (scenario) => scenario.id === "conceptual-leadership-coverage" ? [
        { stage: "retrieval", metadata: { durationMs: 1 }, observation: { evidence: [], candidateEvidenceIdsByRequirement: {}, coverage: [], schemaValid: true } },
        { stage: "candidate_association", metadata: { durationMs: 1 }, error: { code: "candidate_error", message: "safe" } },
        { stage: "reasoning", metadata: { durationMs: 0 }, error: { code: "blocked", message: "upstream" } }
      ] : []
    }
    const run = await createRunEvaluationUseCase({ datasetLoader: { load: async () => dataset }, pipeline: failingPipeline, repository: new InMemoryEvaluationRepository(), runtime }).execute({ scenarioId: "conceptual-leadership-coverage" })
    expect(run.status).toBe("errored")
    expect(run.results.map((result) => [result.stage, result.status])).toEqual([["retrieval", "failed"], ["candidate_association", "errored"], ["reasoning", "blocked"]])
  })

  it("continues independent scenarios and isolates throwing observability", async () => {
    const dataset = await new FileEvaluationDatasetLoader().load()
    const seen: string[] = []
    const pipeline: EvaluationPipeline = {
      execute: async (scenario: EvaluationScenario) => {
        seen.push(scenario.id)
        if (seen.length === 1) throw new Error("first scenario failed")
        return [{ stage: "reasoning", metadata: { durationMs: 1 }, observation: { evidence: [], candidateEvidenceIdsByRequirement: {}, coverage: [], schemaValid: true } }]
      }
    }
    const throwingTrace: EvaluationTrace = { stage: async () => { throw new Error("telemetry") }, assertion: async () => { throw new Error("telemetry") }, complete: async () => { throw new Error("telemetry") }, flush: async () => { throw new Error("telemetry") } }
    const observability: EvaluationObservability = { trace: () => throwingTrace }
    const run = await createRunEvaluationUseCase({ datasetLoader: { load: async () => dataset }, pipeline, repository: new InMemoryEvaluationRepository(), runtime, observability }).execute()
    expect(seen).toHaveLength(21)
    expect(run.status).toBe("errored")
  })

  it("rejects an unknown scenario before pipeline execution", async () => {
    let called = false
    await expect(createRunEvaluationUseCase({ datasetLoader: new FileEvaluationDatasetLoader(), pipeline: { execute: async () => { called = true; return [] } }, repository: new InMemoryEvaluationRepository(), runtime }).execute({ scenarioId: "unknown" })).rejects.toThrow("Available scenarios")
    expect(called).toBe(false)
  })
})
