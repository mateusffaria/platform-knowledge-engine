import { describe, expect, it } from "vitest"

import { assertStage } from "../src/modules/evaluation/application/assertions.js"
import { FileEvaluationDatasetLoader } from "../src/modules/evaluation/infrastructure/datasets/file-evaluation-dataset-loader.js"
import { FixtureEvaluationPipeline } from "../src/modules/evaluation/infrastructure/pipeline/fixture-evaluation-pipeline.js"

describe("resume planning golden evaluation", () => {
  it("loads versioned bilingual, length, sparse, unsafe-content, and identity scenarios", async () => {
    const dataset = await new FileEvaluationDatasetLoader().load()
    const resume = dataset.scenarios.filter((scenario) => scenario.resumePlanning)
    expect(resume).toHaveLength(15)
    expect(resume.map((scenario) => scenario.id)).toEqual(expect.arrayContaining([
      "resume-valid-en-concise", "resume-valid-en-detailed", "resume-valid-pt", "resume-sparse-evidence",
      "resume-fabricated-evidence", "resume-discarded-evidence", "resume-altered-metric", "resume-canonical-drift",
      "resume-unsupported-technology", "resume-skill-inflation", "resume-uncovered-fabrication", "resume-locale-mismatch",
      "resume-length-exceeded", "resume-schema-invalid", "resume-identity-reuse"
    ]))
    const concise: any = resume.find((scenario) => scenario.id === "resume-valid-en-concise")?.resumePlanning?.response
    const detailed: any = resume.find((scenario) => scenario.id === "resume-valid-en-detailed")?.resumePlanning?.response
    expect(detailed.plannedExperiences[0].bullets.length).toBeGreaterThan(concise.plannedExperiences[0].bullets.length)
  })

  it("passes every deterministic expected outcome without mutating fixtures", async () => {
    const dataset = await new FileEvaluationDatasetLoader().load()
    const pipeline = new FixtureEvaluationPipeline(undefined, () => 0)
    for (const scenario of dataset.scenarios.filter((item) => item.resumePlanning)) {
      const before = JSON.stringify(scenario)
      const execution = (await pipeline.execute(scenario)).find((item) => item.stage === "resume_planning")
      expect(execution?.error, scenario.id).toBeUndefined()
      expect(execution?.observation, scenario.id).toBeDefined()
      expect(assertStage(scenario, "resume_planning", execution!.observation!).every((assertion) => assertion.passed), scenario.id).toBe(true)
      expect(JSON.stringify(scenario), scenario.id).toBe(before)
    }
  })

  it("reports fabricated evidence and altered metrics with stable issue paths", async () => {
    const dataset = await new FileEvaluationDatasetLoader().load()
    const pipeline = new FixtureEvaluationPipeline(undefined, () => 0)
    for (const [scenarioId, expectedCode] of [["resume-fabricated-evidence", "unknown_evidence_id"], ["resume-altered-metric", "unsupported_metric"]] as const) {
      const scenario = dataset.scenarios.find((item) => item.id === scenarioId)!
      const observation = (await pipeline.execute(scenario)).find((item) => item.stage === "resume_planning")!.observation!
      expect(observation.validationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: expectedCode, path: expect.any(String) })]))
    }
  })
})
