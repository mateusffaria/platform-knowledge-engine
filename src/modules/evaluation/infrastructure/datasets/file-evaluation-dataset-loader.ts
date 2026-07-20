import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"

import { EvaluationDataset, EvaluationExpectation, EvaluationScenario } from "../../domain/model.js"
import { EvaluationDatasetLoader } from "../../application/ports/dataset-loader.js"

const id = z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/)
const stage = z.enum(["retrieval", "candidate_association", "reasoning", "resume_planning"])
const coverage = z.enum(["missing", "weak", "partial", "strong"])
const baseExpectation = { id, stage }
const expectationSchema = z.discriminatedUnion("type", [
  z.object({ ...baseExpectation, type: z.literal("expected_evidence_ids"), evidenceIds: z.array(id), k: z.number().int().positive().optional() }),
  z.object({ ...baseExpectation, type: z.literal("forbidden_evidence_ids"), evidenceIds: z.array(id) }),
  z.object({ ...baseExpectation, type: z.literal("top_k_evidence"), evidenceIds: z.array(id), k: z.number().int().positive() }),
  z.object({ ...baseExpectation, type: z.literal("maximum_evidence_count"), maximum: z.number().int().nonnegative() }),
  z.object({ ...baseExpectation, type: z.literal("coverage_range"), requirementId: id, minimum: coverage.optional(), maximum: coverage.optional() }),
  z.object({ ...baseExpectation, type: z.literal("expected_missing_requirements"), requirementIds: z.array(id) }),
  z.object({ ...baseExpectation, type: z.literal("required_provenance"), evidenceIds: z.array(id).optional(), fields: z.array(z.enum(["sourceDocumentId", "sourceReferenceId", "locator"])).min(1) }),
  z.object({ ...baseExpectation, type: z.literal("candidate_membership") }),
  z.object({ ...baseExpectation, type: z.literal("no_fabricated_evidence") }),
  z.object({ ...baseExpectation, type: z.literal("schema_validity"), valid: z.boolean() }),
  z.object({ ...baseExpectation, type: z.literal("resume_plan_validity"), valid: z.boolean(), issueCodes: z.array(z.string().min(1)).optional() }),
  z.object({ ...baseExpectation, type: z.literal("resume_plan_identity_reuse") })
])

const sourceSchema = z.object({
  sourceDocumentId: id,
  sourceReferenceId: id.optional(),
  locator: z.string().min(1).optional(),
  excerpt: z.string()
})

const requirementSchema = z.object({
  id,
  text: z.string().min(1),
  type: z.enum(["skill", "technology", "experience", "responsibility", "seniority", "domain", "education", "language"]),
  importance: z.enum(["required", "preferred"]),
  query: z.string().min(1)
})

const presentationSchema = z.object({
  sourceOrganizationOrExperienceId: id,
  organization: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  technologies: z.array(z.string()),
  metrics: z.array(z.string())
})

const evidenceSchema = z.object({
  id,
  knowledgeAssetId: id,
  claimText: z.string().min(1),
  claimStatus: z.enum(["confirmed", "single_source", "needs_review", "rejected", "superseded"]),
  confidenceScore: z.number().min(0).max(100),
  structuredScore: z.number().optional(),
  semanticScore: z.number().optional(),
  tags: z.array(z.string()),
  requirementIds: z.array(id),
  sources: z.array(sourceSchema),
  claimType: z.string().optional(),
  subjectType: z.string().optional(),
  exaggerationRisk: z.enum(["low", "medium", "high"]).optional(),
  presentation: presentationSchema.optional()
})

const reasoningSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  coverage: z.array(z.object({
    requirementId: id,
    coverageStatus: coverage,
    selectedEvidenceIds: z.array(id),
    rejectedEvidenceIds: z.array(id)
  })),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional()
})

const scenarioSchema = z.object({
  id,
  description: z.string().min(1),
  requirements: z.array(requirementSchema),
  evidence: z.array(evidenceSchema),
  expectations: z.array(expectationSchema),
  reasoning: reasoningSchema.optional(),
  skipStages: z.array(stage).optional(),
  resumePlanning: z.object({
    language: z.enum(["pt-BR", "en"]),
    length: z.enum(["concise", "standard", "detailed"]),
    selectedEvidenceIds: z.array(id).optional(),
    response: z.unknown(),
    identityReuse: z.boolean().optional()
  }).optional()
})

const datasetSchema = z.object({
  schemaVersion: z.string().min(1),
  id,
  version: z.string().min(1),
  scenarios: z.array(scenarioSchema).min(1)
})

const resumePlanningDatasetSchema = z.object({
  schemaVersion: z.literal("resume-planning-evaluation-v1"),
  id,
  version: z.string().min(1),
  input: z.object({ requirements: z.array(requirementSchema), evidence: z.array(evidenceSchema), reasoning: reasoningSchema }),
  scenarios: z.array(z.object({
    id,
    description: z.string().min(1),
    language: z.enum(["pt-BR", "en"]),
    length: z.enum(["concise", "standard", "detailed"]),
    selectedEvidenceIds: z.array(id).optional(),
    response: z.unknown(),
    expected: z.object({ valid: z.boolean(), issueCodes: z.array(z.string().min(1)).optional(), identityReuse: z.boolean().optional() })
  })).min(1)
})

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))]
}

function expectationEvidenceIds(expectation: EvaluationExpectation): string[] {
  return "evidenceIds" in expectation && expectation.evidenceIds ? expectation.evidenceIds : []
}

function validateReferences(scenario: EvaluationScenario): void {
  const requirementIds = new Set(scenario.requirements.map((item) => item.id))
  const evidenceIds = new Set(scenario.evidence.map((item) => item.id))
  const duplicateRequirementIds = duplicates(scenario.requirements.map((item) => item.id))
  const duplicateEvidenceIds = duplicates(scenario.evidence.map((item) => item.id))
  const duplicateExpectationIds = duplicates(scenario.expectations.map((item) => item.id))
  if (duplicateRequirementIds.length || duplicateEvidenceIds.length || duplicateExpectationIds.length) {
    throw new Error(`Scenario ${scenario.id} contains duplicate IDs: ${[...duplicateRequirementIds, ...duplicateEvidenceIds, ...duplicateExpectationIds].join(", ")}`)
  }

  for (const evidence of scenario.evidence) {
    for (const requirementId of evidence.requirementIds) {
      if (!requirementIds.has(requirementId)) throw new Error(`Scenario ${scenario.id} evidence ${evidence.id} references unknown requirement ${requirementId}.`)
    }
  }
  for (const expectation of scenario.expectations) {
    for (const evidenceId of expectationEvidenceIds(expectation)) {
      if (!evidenceIds.has(evidenceId)) throw new Error(`Scenario ${scenario.id} expectation ${expectation.id} references unknown evidence ${evidenceId}.`)
    }
    if ("requirementId" in expectation && !requirementIds.has(expectation.requirementId)) {
      throw new Error(`Scenario ${scenario.id} expectation ${expectation.id} references unknown requirement ${expectation.requirementId}.`)
    }
    if ("requirementIds" in expectation) {
      for (const requirementId of expectation.requirementIds) {
        if (!requirementIds.has(requirementId)) throw new Error(`Scenario ${scenario.id} expectation ${expectation.id} references unknown requirement ${requirementId}.`)
      }
    }
  }
  for (const entry of scenario.reasoning?.coverage ?? []) {
    if (!requirementIds.has(entry.requirementId)) throw new Error(`Scenario ${scenario.id} reasoning references unknown requirement ${entry.requirementId}.`)
    for (const evidenceId of [...entry.selectedEvidenceIds, ...entry.rejectedEvidenceIds]) {
      if (!evidenceIds.has(evidenceId)) throw new Error(`Scenario ${scenario.id} reasoning references unknown evidence ${evidenceId}.`)
    }
  }
  for (const evidenceId of scenario.resumePlanning?.selectedEvidenceIds ?? []) {
    if (!evidenceIds.has(evidenceId)) throw new Error(`Scenario ${scenario.id} resume planning references unknown evidence ${evidenceId}.`)
  }
}

function normalizeScenario(scenario: EvaluationScenario): EvaluationScenario {
  return {
    ...scenario,
    requirements: [...scenario.requirements].sort((a, b) => a.id.localeCompare(b.id)),
    evidence: [...scenario.evidence].map((evidence) => ({
      ...evidence,
      tags: [...evidence.tags].sort(),
      requirementIds: [...evidence.requirementIds].sort(),
      sources: [...evidence.sources].sort((a, b) => `${a.sourceDocumentId}:${a.sourceReferenceId ?? ""}`.localeCompare(`${b.sourceDocumentId}:${b.sourceReferenceId ?? ""}`))
    })).sort((a, b) => a.id.localeCompare(b.id)),
    expectations: [...scenario.expectations].sort((a, b) => a.id.localeCompare(b.id)),
    reasoning: scenario.reasoning ? {
      ...scenario.reasoning,
      coverage: [...scenario.reasoning.coverage].sort((a, b) => a.requirementId.localeCompare(b.requirementId))
    } : undefined,
    skipStages: scenario.skipStages ? [...scenario.skipStages].sort() : undefined,
    resumePlanning: scenario.resumePlanning ? { ...scenario.resumePlanning, selectedEvidenceIds: scenario.resumePlanning.selectedEvidenceIds ? [...scenario.resumePlanning.selectedEvidenceIds].sort() : undefined } : undefined
  }
}

export function deterministicDatasetHash(dataset: Omit<EvaluationDataset, "hash">): string {
  return createHash("sha256").update(JSON.stringify(dataset)).digest("hex")
}

export class FileEvaluationDatasetLoader implements EvaluationDatasetLoader {
  constructor(private readonly path = resolve(process.cwd(), "src/modules/evaluation/fixtures/golden-v1.json")) {}

  async load(): Promise<EvaluationDataset> {
    const parsed = datasetSchema.parse(JSON.parse(await readFile(this.path, "utf8")))
    const defaultPath = resolve(process.cwd(), "src/modules/evaluation/fixtures/golden-v1.json")
    let rawScenarios: unknown[] = [...parsed.scenarios]
    if (resolve(this.path) === defaultPath) {
      const resumeDataset = resumePlanningDatasetSchema.parse(JSON.parse(await readFile(resolve(process.cwd(), "src/modules/evaluation/fixtures/resume-planning-golden-v1.json"), "utf8")))
      rawScenarios = [...rawScenarios, ...resumeDataset.scenarios.map((scenario) => ({
        id: scenario.id,
        description: scenario.description,
        requirements: resumeDataset.input.requirements,
        evidence: resumeDataset.input.evidence,
        expectations: [
          { id: `${scenario.id}-validity`, stage: "resume_planning", type: "resume_plan_validity", valid: scenario.expected.valid, issueCodes: scenario.expected.issueCodes },
          ...(scenario.expected.identityReuse ? [{ id: `${scenario.id}-identity-reuse`, stage: "resume_planning", type: "resume_plan_identity_reuse" }] : [])
        ],
        reasoning: resumeDataset.input.reasoning,
        skipStages: ["retrieval", "candidate_association", "reasoning"],
        resumePlanning: { language: scenario.language, length: scenario.length, selectedEvidenceIds: scenario.selectedEvidenceIds, response: scenario.response, identityReuse: scenario.expected.identityReuse }
      }))]
    }
    const parsedScenarios = rawScenarios.map((scenario) => scenarioSchema.parse(scenario))
    const duplicateScenarioIds = duplicates(parsedScenarios.map((scenario) => scenario.id))
    if (duplicateScenarioIds.length) throw new Error(`Evaluation dataset contains duplicate scenario IDs: ${duplicateScenarioIds.join(", ")}`)
    const scenarios = parsedScenarios.map((scenario) => normalizeScenario(scenario as EvaluationScenario)).sort((a, b) => a.id.localeCompare(b.id))
    for (const scenario of scenarios) validateReferences(scenario)
    const dataset = { schemaVersion: parsed.schemaVersion, id: parsed.id, version: parsed.version, scenarios }
    return Object.freeze({ ...dataset, hash: deterministicDatasetHash(dataset) })
  }
}
