import { describe, expect, it } from "vitest"

import { freezeResumePlanningInput, ResumePlanningInput } from "../src/modules/documents/application/planning-input.js"
import { buildResumePlanningUserPrompt, resumePlanningPromptVersion } from "../src/modules/documents/application/resume-planning-prompt.js"
import { buildResumePlanOutputJsonSchema, parseResumePlanDraft, ResumePlanDraft, ResumePlanSchemaError, resumePlanDraftSchema, resumePlanOutputJsonSchema } from "../src/modules/documents/application/resume-content-plan-schema.js"
import { ResumePlanValidationError, validateResumePlanDraft } from "../src/modules/documents/application/resume-plan-validator.js"
import { buildResumePlanIdentity, LlmResumeContentPlanner } from "../src/modules/documents/application/services/llm-resume-content-planner.js"
import { CompatibleCuratedEvidencePackNotFoundError, createPlanResumeContentUseCase } from "../src/modules/documents/application/use-cases/plan-resume-content.js"
import { ResumePlanningLlmProvider, ResumePlanningLlmRequest } from "../src/modules/documents/application/ports/resume-planning-llm-provider.js"
import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { resumeLengthProfiles } from "../src/modules/documents/domain/model.js"

function planningInput(): ResumePlanningInput {
  return freezeResumePlanningInput({
    curatedEvidencePack: {
      id: "pack-1",
      jobDescriptionId: "job-1",
      createdAt: new Date("2026-07-20T12:00:00Z"),
      provider: "ollama",
      model: "qwen",
      promptVersion: "evidence/v1",
      requirements: [
        { requirementId: "req-1", requirementText: "TypeScript delivery", importance: "required", coverageStatus: "strong", selectedEvidenceIds: ["ev-1"] },
        { requirementId: "req-missing", requirementText: "Kubernetes", importance: "preferred", coverageStatus: "missing", selectedEvidenceIds: [] }
      ],
      selectedEvidence: [
        {
          evidenceClaimId: "ev-1",
          knowledgeAssetId: "asset-1",
          subjectAssetId: "exp-1",
          subjectType: "professional_experience",
          claimType: "achievement",
          claimCategory: "metric",
          predicate: "improved_reliability",
          claimText: "Improved API latency by 35% using TypeScript.",
          valueText: "35",
          valueUnit: "%",
          claimStatus: "confirmed",
          contribution: "Delivered the API improvement with the platform team.",
          exaggerationRisk: "low",
          requirementIds: ["req-1"],
          presentation: { sourceOrganizationOrExperienceId: "exp-1", organization: "Acme", role: "Engineer", startDate: "2022-01", endDate: "2024-06", technologies: ["TypeScript"], metrics: ["35%"] },
          provenance: [{ sourceDocumentId: "doc-1", sourceReferenceId: "ref-1", locator: "Experience" }]
        },
        {
          evidenceClaimId: "ev-2",
          knowledgeAssetId: "skill-1",
          subjectType: "skill",
          claimType: "skill",
          claimText: "TypeScript",
          claimStatus: "confirmed",
          contribution: "TypeScript skill",
          exaggerationRisk: "low",
          requirementIds: [],
          presentation: { sourceOrganizationOrExperienceId: "skill-1", technologies: ["TypeScript"], metrics: [] },
          provenance: [{ sourceDocumentId: "doc-1", sourceReferenceId: "ref-2" }]
        }
      ],
      discardedEvidenceIds: ["ev-rejected"],
      missingRequirementIds: ["req-missing"],
      warnings: [],
      limitations: []
    }
  })
}

function validDraft(): ResumePlanDraft {
  return {
    professionalSummary: { text: "Built reliable TypeScript services for platform teams.", supportingEvidenceIds: ["ev-1"] },
    plannedExperiences: [{
      sourceExperienceId: "exp-1",
      organization: "Acme",
      role: "Engineer",
      startDate: "2022-01",
      endDate: "2024-06",
      bullets: [{ text: "Improved API latency by 35% with TypeScript.", supportingEvidenceIds: ["ev-1"], targetRequirementIds: ["req-1"], sourceOrganizationOrExperienceId: "exp-1", exaggerationRisk: "low", warnings: [] }]
    }],
    plannedSkillGroups: [{ name: "Languages", skills: ["TypeScript"], supportingEvidenceIds: ["ev-2"] }],
    selectedEvidenceIds: ["ev-1", "ev-2"],
    omittedEvidence: [],
    uncoveredRequirementIds: ["req-missing"],
    warnings: []
  }
}

function clone<T>(value: T): T { return structuredClone(value) }

describe("Resume Content Plan contracts", () => {
  it("defines stable profile bounds and a strict schema-bound output", () => {
    expect(resumeLengthProfiles).toEqual({ concise: { maxWords: 350, maxBullets: 4 }, standard: { maxWords: 650, maxBullets: 8 }, detailed: { maxWords: 1_000, maxBullets: 12 } })
    expect(resumePlanDraftSchema.parse(validDraft())).toEqual(validDraft())
    expect(resumePlanOutputJsonSchema).toMatchObject({ type: "object", additionalProperties: false })
    expect(resumePlanningPromptVersion).toBe("resume-planning/v6")
    expect(resumePlanOutputJsonSchema.properties).toMatchObject({
      selectedEvidenceIds: { description: expect.stringContaining("used evidence IDs") },
      omittedEvidence: { description: expect.stringContaining("eligibleEvidence") }
    })
  })

  it("rejects malformed JSON, unknown fields, and missing bullet grounding", () => {
    expect(() => parseResumePlanDraft("{")) .toThrow(ResumePlanSchemaError)
    expect(() => parseResumePlanDraft(JSON.stringify({ ...validDraft(), surprise: true }))).toThrow(/required schema/)
    const invalid = clone(validDraft()) as any
    delete invalid.plannedExperiences[0].bullets[0].supportingEvidenceIds
    expect(() => parseResumePlanDraft(JSON.stringify(invalid))).toThrow(/required schema/)
  })

  it("freezes and deterministically serializes allowlisted planning input", () => {
    const input = planningInput()
    expect(Object.isFrozen(input)).toBe(true)
    expect(Object.isFrozen(input.curatedEvidencePack.selectedEvidence)).toBe(true)
    const first = buildResumePlanningUserPrompt(input, "en", "concise")
    const second = buildResumePlanningUserPrompt(input, "en", "concise")
    expect(first).toBe(second)
    const payload = JSON.parse(first)
    expect(payload).toMatchObject({
      requestedLanguage: "en",
      requestedLength: "concise",
      limits: { maxWords: 350, maxBullets: 4 },
      curatedEvidencePack: { eligibleEvidence: expect.any(Array) },
      identifierNamespaces: {
        eligibleEvidenceIds: ["ev-1", "ev-2"],
        experienceEvidenceIds: ["ev-1"],
        targetableRequirementIds: ["req-1"],
        uncoveredRequirementIds: ["req-missing"],
        experienceSourceIds: ["exp-1"]
      }
    })
    expect(payload.curatedEvidencePack).not.toHaveProperty("selectedEvidence")
    expect(payload.curatedEvidencePack).not.toHaveProperty("discardedEvidenceIds")
    expect(payload.curatedEvidencePack.requirements[0]).toHaveProperty("eligibleEvidenceIds")
    expect(payload.curatedEvidencePack.requirements[0]).not.toHaveProperty("selectedEvidenceIds")
    expect(first).not.toContain("ev-rejected")
    for (const language of ["en", "pt-BR"] as const) {
      for (const length of ["concise", "standard", "detailed"] as const) {
        expect(JSON.parse(buildResumePlanningUserPrompt(input, language, length))).toMatchObject({ requestedLanguage: language, requestedLength: length, limits: resumeLengthProfiles[length] })
      }
    }
  })

  it("constrains each output field to its input-specific identifier namespace", () => {
    const schema = buildResumePlanOutputJsonSchema(planningInput()) as any
    expect(schema.properties.selectedEvidenceIds.items.enum).toEqual(["ev-1", "ev-2"])
    expect(schema.properties.omittedEvidence.items.$ref).toBe("#/$defs/omitted")
    expect(schema.properties.uncoveredRequirementIds.items.enum).toEqual(["req-missing"])
    expect(schema.$defs.summary.properties.supportingEvidenceIds.items.enum).toEqual(["ev-1", "ev-2"])
    expect(schema.$defs.experienceSummary.properties.supportingEvidenceIds.items.enum).toEqual(["ev-1"])
    expect(schema.$defs.bullet.properties.supportingEvidenceIds.items.enum).toEqual(["ev-1"])
    expect(schema.$defs.bullet.properties.targetRequirementIds.items.enum).toEqual(["req-1"])
    expect(schema.$defs.omitted.properties.evidenceId.enum).toEqual(["ev-1", "ev-2"])
    expect(schema.$defs.experience.properties.sourceExperienceId.enum).toEqual(["exp-1"])
    expect(schema.$defs.bullet.properties.sourceOrganizationOrExperienceId.enum).toEqual(["exp-1"])
  })

  it("excludes an already-used evidence ID from the repair schema's omission namespace", () => {
    const schema = buildResumePlanOutputJsonSchema(planningInput(), {
      issues: [{ code: "selected_and_omitted", value: "ev-1" }]
    }) as any
    expect(schema.$defs.omitted.properties.evidenceId.enum).toEqual(["ev-2"])
  })
})

describe("Resume Content Plan deterministic validation", () => {
  it("accepts a fully grounded valid plan", () => {
    expect(validateResumePlanDraft(validDraft(), planningInput(), "en", "standard")).toEqual([])
  })

  it.each([
    ["unknown evidence", (draft: ResumePlanDraft) => { draft.professionalSummary.supportingEvidenceIds = ["invented"]; draft.selectedEvidenceIds = ["invented", "ev-1", "ev-2"] }, "unknown_evidence_id"],
    ["discarded evidence", (draft: ResumePlanDraft) => { draft.professionalSummary.supportingEvidenceIds = ["ev-rejected"]; draft.selectedEvidenceIds = ["ev-rejected", "ev-1", "ev-2"] }, "discarded_evidence_id"],
    ["altered metric", (draft: ResumePlanDraft) => { draft.plannedExperiences[0].bullets[0].text = "Improved API latency by 50% with TypeScript." }, "unsupported_metric"],
    ["canonical organization drift", (draft: ResumePlanDraft) => { draft.plannedExperiences[0].organization = "Other Corp" }, "canonical_presentation_mismatch"],
    ["canonical bullet source drift", (draft: ResumePlanDraft) => { draft.plannedExperiences[0].bullets[0].sourceOrganizationOrExperienceId = "invented-experience" }, "canonical_presentation_mismatch"],
    ["unsupported technology", (draft: ResumePlanDraft) => { draft.plannedExperiences[0].bullets[0].text += " Deployed Kubernetes." }, "unsupported_technology"],
    ["uncovered requirement targeting", (draft: ResumePlanDraft) => { draft.plannedExperiences[0].bullets[0].targetRequirementIds = ["req-missing"] }, "unsupported_requirement"],
    ["unaccounted selected evidence", (draft: ResumePlanDraft) => { draft.plannedSkillGroups = []; draft.selectedEvidenceIds = ["ev-1"] }, "unaccounted_evidence_id"],
    ["selected and omitted overlap", (draft: ResumePlanDraft) => { draft.omittedEvidence = [{ evidenceId: "ev-2", reason: "length", explanation: "Length limit" }] }, "selected_and_omitted"]
  ])("rejects %s", (_name, mutate, code) => {
    const draft = clone(validDraft())
    mutate(draft)
    expect(validateResumePlanDraft(draft, planningInput(), "en", "standard").map((issue) => issue.code)).toContain(code)
  })

  it("rejects strength inflation and skill-only production experience", () => {
    const input = clone(planningInput())
    input.curatedEvidencePack.selectedEvidence[0].exaggerationRisk = "high"
    const inflated = validDraft()
    inflated.plannedExperiences[0].bullets[0].text = "Led API work and improved latency by 35% with TypeScript."
    expect(validateResumePlanDraft(inflated, input, "en", "standard").map((issue) => issue.code)).toContain("evidence_strength_inflation")

    const skillOnly = validDraft()
    skillOnly.plannedExperiences[0].bullets[0].supportingEvidenceIds = ["ev-2"]
    skillOnly.selectedEvidenceIds = ["ev-1", "ev-2"]
    expect(validateResumePlanDraft(skillOnly, planningInput(), "en", "standard").map((issue) => issue.code)).toContain("skill_promoted_to_experience")

    const skillOnlySummary = validDraft()
    skillOnlySummary.plannedExperiences[0].summary = { text: "TypeScript", supportingEvidenceIds: ["ev-2"] }
    expect(validateResumePlanDraft(skillOnlySummary, planningInput(), "en", "standard").map((issue) => issue.code)).toContain("skill_promoted_to_experience")
  })

  it("reports the exact indexed path and offending evidence ID", () => {
    const draft = validDraft()
    draft.omittedEvidence = [{ evidenceId: "ev-rejected", reason: "other", explanation: "Unavailable evidence" }]
    const issues = validateResumePlanDraft(draft, planningInput(), "en", "standard")
    expect(issues).toContainEqual(expect.objectContaining({
      code: "discarded_evidence_id",
      path: "omittedEvidence[0].evidenceId",
      value: "ev-rejected"
    }))
    expect(new ResumePlanValidationError(issues).message).toContain("discarded_evidence_id@omittedEvidence[0].evidenceId=ev-rejected")
  })

  it("rejects mismatched locale and profile bounds", () => {
    expect(validateResumePlanDraft(validDraft(), planningInput(), "pt-BR", "standard").map((issue) => issue.code)).toContain("language_mismatch")
    const long = validDraft()
    long.plannedExperiences[0].bullets = Array.from({ length: 5 }, () => clone(long.plannedExperiences[0].bullets[0]))
    expect(validateResumePlanDraft(long, planningInput(), "en", "concise").map((issue) => issue.code)).toContain("length_exceeded")
  })

  it("accepts Portuguese content while preserving canonical values", () => {
    const draft = validDraft()
    draft.professionalSummary.text = "Desenvolveu serviços confiáveis em TypeScript para equipes de plataforma."
    draft.plannedExperiences[0].bullets[0].text = "Melhorou a latência da API em 35% com TypeScript."
    draft.omittedEvidence = []
    expect(validateResumePlanDraft(draft, planningInput(), "pt-BR", "standard")).toEqual([])
  })
})

class FakePlanningProvider implements ResumePlanningLlmProvider {
  requests: ResumePlanningLlmRequest[] = []
  responses: Array<string | Error | { content: string; finishReason?: string }> = []

  resolveIdentity(model?: string) { return { provider: "ollama", model: model ?? "qwen" } }
  async generate(request: ResumePlanningLlmRequest) {
    this.requests.push(request)
    const next = this.responses.shift() ?? JSON.stringify(validDraft())
    if (next instanceof Error) throw next
    const response = typeof next === "string" ? { content: next } : next
    return { ...response, provider: "ollama", model: request.model ?? "qwen", usage: { promptTokens: 10, completionTokens: 20 } }
  }
}

describe("LLM Resume Content Planner", () => {
  it("derives stable identities and changes every version dimension", () => {
    const base = { curatedEvidencePackId: "pack-1", provider: "ollama", model: "qwen", promptVersion: "v1", language: "en", length: "standard" }
    const identity = buildResumePlanIdentity(base)
    expect(identity).toHaveLength(64)
    expect(buildResumePlanIdentity(base)).toBe(identity)
    for (const changed of [
      { ...base, curatedEvidencePackId: "pack-2" }, { ...base, provider: "other" }, { ...base, model: "other" },
      { ...base, promptVersion: "v2" }, { ...base, language: "pt-BR" }, { ...base, length: "concise" }
    ]) expect(buildResumePlanIdentity(changed)).not.toBe(identity)
  })

  it("uses schema-bound generation and parses the strict response", async () => {
    const provider = new FakePlanningProvider()
    const planner = new LlmResumeContentPlanner(provider)
    const result = await planner.plan({ input: planningInput(), language: "en", length: "standard", model: "custom" })
    expect(result.draft).toEqual(validDraft())
    expect(provider.requests[0]).toMatchObject({ model: "custom", responseFormat: resumePlanOutputJsonSchema, disableThinking: true })
    expect(provider.requests[0].userPrompt).not.toContain("rawContent")
  })

  it("retries transport and truncation failures once but not unsupported schemas", async () => {
    const provider = new FakePlanningProvider()
    provider.responses = [new Error("offline"), JSON.stringify(validDraft())]
    await expect(new LlmResumeContentPlanner(provider).plan({ input: planningInput(), language: "en", length: "standard" })).resolves.toMatchObject({ draft: validDraft() })
    expect(provider.requests).toHaveLength(2)
    expect(provider.requests[1].maxPredict).toBe(8_192)

    const truncated = new FakePlanningProvider()
    truncated.responses = [{ content: "", finishReason: "length" }, JSON.stringify(validDraft())]
    await expect(new LlmResumeContentPlanner(truncated).plan({ input: planningInput(), language: "en", length: "standard" })).resolves.toBeDefined()
    expect(truncated.requests).toHaveLength(2)

    const malformed = new FakePlanningProvider()
    malformed.responses = ["{}", JSON.stringify(validDraft())]
    await expect(new LlmResumeContentPlanner(malformed).plan({ input: planningInput(), language: "en", length: "standard" })).rejects.toBeInstanceOf(ResumePlanSchemaError)
    expect(malformed.requests).toHaveLength(1)
  })
})

describe("Plan Resume Content use case", () => {
  function harness(options: { pack?: ResumePlanningInput["curatedEvidencePack"]; cached?: ResumeContentPlan; draft?: ResumePlanDraft; saveWinner?: ResumeContentPlan } = {}) {
    const provider = new FakePlanningProvider()
    if (options.draft) provider.responses = [JSON.stringify(options.draft)]
    const planner = new LlmResumeContentPlanner(provider)
    const saved: ResumeContentPlan[] = []
    const useCase = createPlanResumeContentUseCase({
      curatedEvidenceReader: { async findLatestCompatible() { return options.pack === undefined ? planningInput().curatedEvidencePack : options.pack } },
      planRepository: {
        async findByPlanIdentity() { return options.cached },
        async save(plan) { saved.push(plan); return options.saveWinner ?? plan }
      },
      planner,
      now: () => new Date("2026-07-20T15:00:00Z"),
      newId: () => "00000000-0000-4000-8000-000000000001"
    })
    return { provider, saved, useCase }
  }

  it("fails before inference when no compatible pack exists", async () => {
    const provider = new FakePlanningProvider()
    const useCase = createPlanResumeContentUseCase({
      curatedEvidenceReader: { async findLatestCompatible() { return undefined } },
      planRepository: { async findByPlanIdentity() { return undefined }, async save(plan) { return plan } },
      planner: new LlmResumeContentPlanner(provider)
    })
    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })).rejects.toBeInstanceOf(CompatibleCuratedEvidencePackNotFoundError)
    expect(provider.requests).toHaveLength(0)
  })

  it("validates, versions, and persists a generated immutable snapshot", async () => {
    const { useCase, saved, provider } = harness()
    const result = await useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard", model: "custom" })
    expect(saved).toHaveLength(1)
    expect(result).toMatchObject({ jobDescriptionId: "job-1", curatedEvidencePackId: "pack-1", provider: "ollama", model: "custom", promptVersion: resumePlanningPromptVersion, schemaVersion: "resume-content-plan/v1" })
    expect(provider.requests).toHaveLength(1)
  })

  it("reports generated and cached planning stages without making feedback outcome-critical", async () => {
    const generatedStages: string[] = []
    const first = harness()
    const stored = await first.useCase.execute({
      jobDescriptionId: "job-1",
      language: "en",
      length: "standard",
      onProgress: (stage) => generatedStages.push(stage)
    })
    expect(generatedStages).toEqual([
      "loading_evidence",
      "checking_existing_plan",
      "generating_content",
      "validating_content",
      "persisting_plan"
    ])

    const cachedStages: string[] = []
    await harness({ cached: stored }).useCase.execute({
      jobDescriptionId: "job-1",
      language: "en",
      length: "standard",
      onProgress: (stage) => cachedStages.push(stage)
    })
    expect(cachedStages).toEqual(["loading_evidence", "checking_existing_plan", "reusing_existing_plan"])

    await expect(harness().useCase.execute({
      jobDescriptionId: "job-1",
      language: "en",
      length: "standard",
      onProgress: () => { throw new Error("terminal unavailable") }
    })).resolves.toBeDefined()
  })

  it("returns cache hits without inference and preserves the stored plan", async () => {
    const first = harness()
    const cached = await first.useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })
    const second = harness({ cached })
    await expect(second.useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })).resolves.toBe(cached)
    expect(second.provider.requests).toHaveLength(0)
    expect(second.saved).toHaveLength(0)
  })

  it("persists nothing when deterministic validation fails", async () => {
    const invalid = validDraft()
    invalid.plannedExperiences[0].bullets[0].text = "Improved API latency by 99% with Kubernetes."
    const { useCase, saved, provider } = harness({ draft: invalid })
    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })).rejects.toMatchObject({ name: "ResumePlanValidationError" })
    expect(saved).toEqual([])
    expect(provider.requests).toHaveLength(1)
  })

  it("regenerates once for evidence membership failures without exposing discarded IDs", async () => {
    const invalid = validDraft()
    invalid.omittedEvidence = [{ evidenceId: "ev-rejected", reason: "other", explanation: "Rejected upstream" }]
    const originalInvalid = clone(invalid)
    const { useCase, saved, provider } = harness()
    provider.responses = [JSON.stringify(invalid), JSON.stringify(validDraft())]

    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })).resolves.toBeDefined()

    expect(provider.requests).toHaveLength(2)
    expect(provider.requests[0].userPrompt).not.toContain("ev-rejected")
    expect(provider.requests[1].userPrompt).not.toContain("ev-rejected")
    expect(JSON.parse(provider.requests[1].userPrompt).repairRequest).toEqual({
      instruction: expect.stringContaining("Regenerate the complete response"),
      issues: [{
        code: "discarded_evidence_id",
        path: "omittedEvidence[0].evidenceId",
        resolution: expect.stringContaining("Do not reference discarded evidence")
      }]
    })
    expect(invalid).toEqual(originalInvalid)
    expect(saved).toHaveLength(1)
  })

  it("repairs mixed evidence and requirement UUID namespaces from one generated draft", async () => {
    const mixedRequirementIds = [
      "53db1185-fd97-4037-97a5-b5f8138c0acf",
      "bbf793c5-be4f-497b-9129-d913703f2cac",
      "c502eb10-66fe-4b88-9472-48f166023f97",
      "ea963ca6-983a-4e24-8732-6e2377d152b9"
    ]
    const pack = clone(planningInput().curatedEvidencePack)
    pack.requirements = [
      pack.requirements[0],
      ...mixedRequirementIds.map((requirementId) => ({
        requirementId,
        requirementText: `Missing requirement ${requirementId}`,
        importance: "preferred" as const,
        coverageStatus: "missing" as const,
        selectedEvidenceIds: []
      }))
    ]
    pack.missingRequirementIds = mixedRequirementIds
    const invalid = validDraft()
    invalid.omittedEvidence = mixedRequirementIds.map((evidenceId) => ({ evidenceId, reason: "other" as const, explanation: "Not used" }))
    invalid.uncoveredRequirementIds = mixedRequirementIds
    invalid.plannedExperiences[0].bullets[0].targetRequirementIds = [mixedRequirementIds[3]]
    const repaired = validDraft()
    repaired.uncoveredRequirementIds = mixedRequirementIds
    const { useCase, saved, provider } = harness({ pack })
    provider.responses = [JSON.stringify(invalid), JSON.stringify(repaired)]

    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })).resolves.toBeDefined()

    expect(provider.requests).toHaveLength(2)
    const repair = JSON.parse(provider.requests[1].userPrompt).repairRequest
    expect(repair.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown_evidence_id", path: "omittedEvidence[3].evidenceId", value: mixedRequirementIds[3] }),
      expect.objectContaining({ code: "unsupported_requirement", path: "plannedExperiences[0].bullets[0].targetRequirementIds[0]", value: mixedRequirementIds[3] })
    ]))
    expect(repair.issues).toHaveLength(5)
    const responseSchema = provider.requests[0].responseFormat as any
    expect(responseSchema.$defs.omitted.properties.evidenceId.enum).toEqual(["ev-1", "ev-2"])
    expect(responseSchema.$defs.bullet.properties.targetRequirementIds.items.enum).toEqual(["req-1"])
    expect(responseSchema.properties.uncoveredRequirementIds.items.enum).toEqual([...mixedRequirementIds].sort())
    expect(saved).toHaveLength(1)
  })

  it("rejects a failed repair without silently removing entries or persisting", async () => {
    const invalid = validDraft()
    invalid.omittedEvidence = [{ evidenceId: "ev-rejected", reason: "other", explanation: "Rejected upstream" }]
    const originalInvalid = clone(invalid)
    const { useCase, saved, provider } = harness()
    provider.responses = [JSON.stringify(invalid), JSON.stringify(invalid)]

    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })).rejects.toThrow(
      "discarded_evidence_id@omittedEvidence[0].evidenceId=ev-rejected"
    )

    expect(provider.requests).toHaveLength(2)
    expect(invalid).toEqual(originalInvalid)
    expect(saved).toEqual([])
  })

  it("gives deterministic selected-and-omitted repairs the allowlisted ID and an explicit resolution", async () => {
    const invalid = validDraft()
    invalid.omittedEvidence = [{ evidenceId: "ev-1", reason: "length", explanation: "Concise limit" }]
    const { useCase, saved, provider } = harness()
    provider.responses = [JSON.stringify(invalid), JSON.stringify(invalid)]

    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "concise" })).rejects.toThrow(
      "selected_and_omitted@omittedEvidence[0].evidenceId=ev-1"
    )

    const repairIssue = JSON.parse(provider.requests[1].userPrompt).repairRequest.issues[0]
    expect(repairIssue).toEqual({
      code: "selected_and_omitted",
      path: "omittedEvidence[0].evidenceId",
      value: "ev-1",
      resolution: expect.stringContaining("If it remains cited")
    })
    const repairSchema = provider.requests[1].responseFormat as any
    expect(repairSchema.$defs.omitted.properties.evidenceId.enum).toEqual(["ev-2"])
    expect(provider.requests).toHaveLength(2)
    expect(saved).toEqual([])
  })

  it("repairs a selected-and-omitted overlap combined with skill-only experience evidence", async () => {
    const pack = clone(planningInput().curatedEvidencePack)
    const experiencePresentation = clone(pack.selectedEvidence[0].presentation)
    pack.selectedEvidence[1].presentation = experiencePresentation
    const invalid = validDraft()
    invalid.plannedExperiences[0].bullets[0] = {
      text: "TypeScript",
      supportingEvidenceIds: ["ev-2"],
      targetRequirementIds: [],
      sourceOrganizationOrExperienceId: "exp-1",
      exaggerationRisk: "low",
      warnings: []
    }
    invalid.omittedEvidence = [{ evidenceId: "ev-1", reason: "length", explanation: "Concise limit" }]
    expect(validateResumePlanDraft(invalid, freezeResumePlanningInput({ curatedEvidencePack: pack }), "en", "concise").map((issue) => issue.code)).toEqual([
      "selected_and_omitted",
      "skill_promoted_to_experience"
    ])

    const { useCase, saved, provider } = harness({ pack })
    provider.responses = [JSON.stringify(invalid), JSON.stringify(validDraft())]

    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "concise" })).resolves.toBeDefined()

    const repairRequest = JSON.parse(provider.requests[1].userPrompt).repairRequest
    expect(repairRequest.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "selected_and_omitted", value: "ev-1" }),
      expect.objectContaining({ code: "skill_promoted_to_experience", resolution: expect.stringContaining("experienceEvidenceIds") })
    ]))
    const repairSchema = provider.requests[1].responseFormat as any
    expect(repairSchema.$defs.bullet.properties.supportingEvidenceIds.items.enum).toEqual(["ev-1"])
    expect(repairSchema.$defs.omitted.properties.evidenceId.enum).toEqual(["ev-2"])
    expect(saved).toHaveLength(1)
  })

  it("returns the repository winner from a concurrent uniqueness race", async () => {
    const initial = harness()
    const winner = await initial.useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })
    const competing = harness({ saveWinner: winner })
    const result = await competing.useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })
    expect(result).toBe(winner)
    expect(competing.saved).toHaveLength(1)
  })

  it("accepts sparse evidence without unsupported padding", async () => {
    const input = clone(planningInput().curatedEvidencePack)
    input.selectedEvidence = input.selectedEvidence.filter((evidence) => evidence.evidenceClaimId === "ev-1")
    const draft = validDraft()
    draft.plannedSkillGroups = []
    draft.selectedEvidenceIds = ["ev-1"]
    const { useCase } = harness({ pack: input, draft })
    await expect(useCase.execute({ jobDescriptionId: "job-1", language: "en", length: "detailed" })).resolves.toMatchObject({ selectedEvidenceIds: ["ev-1"] })
  })

  it("fails open when observability throws and emits no generation for cache hits", async () => {
    const throwing: any = {
      trace: () => { throw new Error("trace unavailable") },
      run: () => { throw new Error("exporter unavailable") },
      record: () => { throw new Error("metric unavailable") }
    }
    const provider = new FakePlanningProvider()
    const planner = new LlmResumeContentPlanner(provider, throwing)
    const generated = createPlanResumeContentUseCase({
      curatedEvidenceReader: { async findLatestCompatible() { return planningInput().curatedEvidencePack } },
      planRepository: { async findByPlanIdentity() { return undefined }, async save(plan) { return plan } },
      planner, observability: throwing,
      newId: () => "00000000-0000-4000-8000-000000000001"
    })
    const stored = await generated.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })
    expect(stored.id).toBe("00000000-0000-4000-8000-000000000001")

    const generations: unknown[] = []
    const observable: any = {
      trace: () => ({ event: async () => undefined, generation: async (value: unknown) => { generations.push(value) }, flush: async () => undefined }),
      run: async (_stage: string, _attributes: unknown, action: () => unknown) => action(), record: () => undefined
    }
    const cached = createPlanResumeContentUseCase({
      curatedEvidenceReader: { async findLatestCompatible() { return planningInput().curatedEvidencePack } },
      planRepository: { async findByPlanIdentity() { return stored }, async save(plan) { return plan } },
      planner: new LlmResumeContentPlanner(new FakePlanningProvider(), observable), observability: observable
    })
    await cached.execute({ jobDescriptionId: "job-1", language: "en", length: "standard" })
    expect(generations).toEqual([])
  })
})
