import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { FileEvaluationDatasetLoader } from "../src/modules/evaluation/infrastructure/datasets/file-evaluation-dataset-loader.js"
import { FixtureEvaluationPipeline } from "../src/modules/evaluation/infrastructure/pipeline/fixture-evaluation-pipeline.js"

const fixturePath = resolve(process.cwd(), "src/modules/evaluation/fixtures/golden-v1.json")

async function changedFixture(change: (input: any) => void): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pke-evaluation-"))
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"))
  change(fixture)
  const path = join(directory, "dataset.json")
  await writeFile(path, JSON.stringify(fixture), "utf8")
  return path
}

describe("evaluation datasets", () => {
  it("loads all golden scenario families in stable order with a deterministic hash", async () => {
    const loader = new FileEvaluationDatasetLoader(fixturePath)
    const first = await loader.load()
    const second = await loader.load()

    expect(first.hash).toBe(second.hash)
    expect(first.scenarios.map((scenario) => scenario.id)).toEqual([
      "conceptual-leadership-coverage",
      "empty-candidate-pack",
      "exact-technology-coverage",
      "missing-technology",
      "redundant-candidates",
      "resume-altered-metric",
      "resume-canonical-drift",
      "resume-discarded-evidence",
      "resume-fabricated-evidence",
      "resume-identity-reuse",
      "resume-length-exceeded",
      "resume-locale-mismatch",
      "resume-schema-invalid",
      "resume-skill-inflation",
      "resume-sparse-evidence",
      "resume-uncovered-fabrication",
      "resume-unsupported-technology",
      "resume-valid-en-concise",
      "resume-valid-en-detailed",
      "resume-valid-pt",
      "trust-policy"
    ])
    expect(first.scenarios.every((scenario) => scenario.expectations.every((item, index, items) => index === 0 || items[index - 1].id.localeCompare(item.id) <= 0))).toBe(true)
  })

  it("rejects duplicate and dangling identities before execution", async () => {
    const duplicate = await changedFixture((fixture) => fixture.scenarios.push(structuredClone(fixture.scenarios[0])))
    await expect(new FileEvaluationDatasetLoader(duplicate).load()).rejects.toThrow("duplicate scenario IDs")

    const dangling = await changedFixture((fixture) => fixture.scenarios[0].expectations[0].evidenceIds.push("unknown-claim"))
    await expect(new FileEvaluationDatasetLoader(dangling).load()).rejects.toThrow("unknown evidence unknown-claim")
  })

  it("treats missing evidence as a closed-world fixture fact and never mutates inputs", async () => {
    const dataset = await new FileEvaluationDatasetLoader(fixturePath).load()
    const scenario = dataset.scenarios.find((item) => item.id === "missing-technology")
    if (!scenario) throw new Error("Missing golden scenario")
    const before = JSON.stringify(scenario)
    const executions = await new FixtureEvaluationPipeline(undefined, () => 0).execute(scenario)

    expect(executions.find((item) => item.stage === "retrieval")?.observation?.evidence).toEqual([])
    expect(executions.find((item) => item.stage === "reasoning")?.observation?.coverage).toEqual([
      expect.objectContaining({ requirementId: "kubernetes", coverageStatus: "missing", selectedEvidenceIds: [] })
    ])
    expect(JSON.stringify(scenario)).toBe(before)
  })
})
