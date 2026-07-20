import { describe, expect, it } from "vitest"

import { CuratedEvidencePack } from "../src/modules/jobs/domain/model.js"
import { DrizzleCompatibleCuratedEvidenceReader, mapCompatibleCuratedEvidencePack } from "../src/modules/documents/infrastructure/repositories/drizzle-compatible-curated-evidence-reader.js"
import { DrizzleResumeContentPlanRepository } from "../src/modules/documents/infrastructure/repositories/drizzle-resume-content-plan-repository.js"
import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { curatedEvidencePacks, experiences, projects, resumeContentPlans, skills } from "../src/shared/database/schema.js"

function curatedPack(overrides: Partial<CuratedEvidencePack> = {}): CuratedEvidencePack {
  const evidence = {
    evidenceClaimId: "00000000-0000-4000-8000-000000000010",
    knowledgeAssetId: "00000000-0000-4000-8000-000000000011",
    subjectAssetId: "00000000-0000-4000-8000-000000000012",
    subjectType: "professional_experience",
    claimType: "achievement",
    claimCategory: "metric",
    predicate: "improved_reliability",
    claimText: "Improved latency by 35% with TypeScript.",
    valueText: "35",
    valueUnit: "%",
    claimStatus: "confirmed",
    sources: [{ sourceDocumentId: "00000000-0000-4000-8000-000000000013", sourceReferenceId: "00000000-0000-4000-8000-000000000014", locator: "Experience", excerpt: "private excerpt", sourcePath: "/private/profile.md" }],
    objectiveSignals: { confidenceScore: 95, finalScore: 90, retrievalStrategies: ["structured"] }
  }
  const selection = { evidenceClaimId: evidence.evidenceClaimId, reason: "Direct evidence", contribution: "Contributed with the team", exaggerationRisk: "low" as const, evidence }
  return {
    id: "00000000-0000-4000-8000-000000000020",
    runIdentity: "run",
    jobDescriptionId: "00000000-0000-4000-8000-000000000021",
    candidatePackVersion: "candidate/v1",
    candidatePackHash: "hash",
    provider: "ollama",
    model: "qwen",
    promptVersion: "reason/v1",
    createdAt: new Date("2026-07-20T12:00:00Z"),
    overallCoverageSummary: "Strong",
    requirementCoverage: [{ requirementId: "req-1", requirementText: "TypeScript", importance: "required", coverageStatus: "strong", selectedEvidenceIds: [evidence.evidenceClaimId], rejectedCandidateEvidenceIds: [], selections: [selection], rejections: [], strengthFactors: [], limitations: [], explanation: "Supported" }],
    recommendedEvidence: [selection],
    discardedEvidence: [],
    missingEvidence: [],
    warnings: [],
    limitations: [],
    ...overrides
  }
}

function presentationRows() {
  return {
    experiences: [{ id: "experience-row", knowledgeAssetId: "00000000-0000-4000-8000-000000000012", evidenceClaimId: "00000000-0000-4000-8000-000000000010", sourceReferenceId: "ref", role: "Engineer", organization: "Acme", startDate: "2022-01", endDate: "2024-06", description: null }] as any,
    projects: [{ id: "project-row", knowledgeAssetId: "00000000-0000-4000-8000-000000000012", evidenceClaimId: "00000000-0000-4000-8000-000000000010", sourceReferenceId: "ref", name: "API", description: null, technologies: ["TypeScript"] }] as any,
    skills: [] as any
  }
}

function storedRow(pack: CuratedEvidencePack): any {
  const { id, runIdentity, jobDescriptionId, jobAnalysisId, candidatePackVersion, candidatePackHash, provider, model, promptVersion, createdAt, ...curatedEvidence } = pack
  return { id, runIdentity, jobDescriptionId, jobAnalysisId: jobAnalysisId ?? null, candidatePackVersion, candidatePackHash, provider, model, promptVersion, createdAt, curatedEvidence }
}

function plan(): ResumeContentPlan {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    planIdentity: "a".repeat(64),
    schemaVersion: "resume-content-plan/v1",
    jobDescriptionId: "00000000-0000-4000-8000-000000000021",
    curatedEvidencePackId: "00000000-0000-4000-8000-000000000020",
    language: "en",
    length: "standard",
    professionalSummary: { text: "Built reliable services.", supportingEvidenceIds: ["ev-1"] },
    plannedExperiences: [],
    plannedSkillGroups: [],
    selectedEvidenceIds: ["ev-1"],
    omittedEvidence: [],
    uncoveredRequirementIds: [],
    warnings: [],
    provider: "ollama",
    model: "qwen",
    promptVersion: "resume-planning/v1",
    createdAt: new Date("2026-07-20T15:00:00Z")
  }
}

describe("Curated evidence planning input adapter", () => {
  it("maps only selected evidence and allowlisted presentation metadata", () => {
    const rows = presentationRows()
    rows.experiences[0].evidenceClaimId = "00000000-0000-4000-8000-000000000099"
    rows.projects[0].evidenceClaimId = "00000000-0000-4000-8000-000000000098"
    const mapped = mapCompatibleCuratedEvidencePack(curatedPack(), rows)
    expect(mapped.selectedEvidence).toHaveLength(1)
    expect(mapped.selectedEvidence[0]).toMatchObject({
      evidenceClaimId: "00000000-0000-4000-8000-000000000010",
      requirementIds: ["req-1"],
      presentation: { sourceOrganizationOrExperienceId: "00000000-0000-4000-8000-000000000012", organization: "Acme", role: "Engineer", startDate: "2022-01", endDate: "2024-06", technologies: ["TypeScript"], metrics: ["35%"] }
    })
    const serialized = JSON.stringify(mapped)
    expect(serialized).not.toContain("private excerpt")
    expect(serialized).not.toContain("/private/profile.md")
    expect(serialized).not.toContain("objectiveSignals")
  })

  it("does not globally discard evidence selected for another requirement", () => {
    const pack = curatedPack()
    pack.discardedEvidence = [{ evidenceClaimId: pack.recommendedEvidence[0].evidenceClaimId, reason: "redundant", explanation: "Retained elsewhere", evidence: pack.recommendedEvidence[0].evidence }]
    expect(mapCompatibleCuratedEvidencePack(pack, presentationRows()).discardedEvidenceIds).toEqual([])
  })

  it("skips malformed newer packs and selects the latest compatible row", async () => {
    const valid = storedRow(curatedPack())
    const malformed = { ...valid, id: "00000000-0000-4000-8000-000000000099", createdAt: new Date("2026-07-20T13:00:00Z"), curatedEvidence: { bad: true } }
    const rowsByTable = new Map<any, any[]>([[curatedEvidencePacks, [malformed, valid]], [experiences, presentationRows().experiences], [projects, presentationRows().projects], [skills, []]])
    const db: any = {
      select: () => ({ from: (table: any) => ({ where: () => table === curatedEvidencePacks ? { orderBy: async () => rowsByTable.get(table) } : Promise.resolve(rowsByTable.get(table)) }) })
    }
    const result = await new DrizzleCompatibleCuratedEvidenceReader(db).findLatestCompatible(valid.jobDescriptionId)
    expect(result?.id).toBe(valid.id)
    expect(result?.selectedEvidence[0].presentation.organization).toBe("Acme")
  })
})

describe("Drizzle Resume Content Plan repository", () => {
  it("round-trips an immutable plan snapshot", async () => {
    let row: any
    const db: any = {
      insert: (table: any) => {
        expect(table).toBe(resumeContentPlans)
        return { values: (values: any) => ({ onConflictDoNothing: () => ({ returning: async () => {
          row = { ...values, resumePlan: { ...values.resumePlan, createdAt: values.resumePlan.createdAt.toISOString() } }
          return [row]
        } }) }) }
      },
      select: () => ({ from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) })
    }
    const repository = new DrizzleResumeContentPlanRepository(db)
    const stored = await repository.save(plan())
    expect(stored).toEqual(plan())
    await expect(repository.findByPlanIdentity(plan().planIdentity)).resolves.toEqual(plan())
  })

  it("returns the existing winner after a concurrent insert conflict", async () => {
    const winner = plan()
    const row = { planIdentity: winner.planIdentity, resumePlan: { ...winner, createdAt: winner.createdAt.toISOString() } }
    const db: any = {
      insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => [] }) }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [row] }) }) })
    }
    await expect(new DrizzleResumeContentPlanRepository(db).save({ ...winner, id: "00000000-0000-4000-8000-000000000002" })).resolves.toEqual(winner)
  })
})
