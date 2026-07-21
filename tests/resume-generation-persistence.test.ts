import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { ResumeArtifactManifest } from "../src/modules/documents/domain/resume-document.js"
import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { DrizzleCandidateResumeMetadataReader } from "../src/modules/documents/infrastructure/repositories/drizzle-candidate-resume-metadata-reader.js"
import { DrizzleGeneratedResumeArtifactRepository } from "../src/modules/documents/infrastructure/repositories/drizzle-generated-resume-artifact-repository.js"
import { DrizzleResumeContentPlanRepository } from "../src/modules/documents/infrastructure/repositories/drizzle-resume-content-plan-repository.js"
import { DrizzleResumeGenerationSourceReader } from "../src/modules/documents/infrastructure/repositories/drizzle-resume-generation-source-reader.js"
import { curatedEvidencePacks, evidenceClaims, generatedResumeArtifacts, knowledgeAssets, resumeContentPlans, sourceDocuments } from "../src/shared/database/schema.js"

function plan(id = "00000000-0000-4000-8000-000000000001", createdAt = new Date("2026-07-21T10:00:00Z")): ResumeContentPlan {
  return { id, planIdentity: id.replaceAll("-", "").padEnd(64, "a"), schemaVersion: "resume-content-plan/v2", jobDescriptionId: "00000000-0000-4000-8000-000000000002", curatedEvidencePackId: "00000000-0000-4000-8000-000000000003", language: "en", length: "standard", professionalSummary: { text: "Summary", supportingEvidenceIds: ["ev-1"] }, plannedExperiences: [], plannedSkillGroups: [], selectedEvidenceIds: ["ev-1"], omittedEvidence: [], uncoveredRequirementIds: [], warnings: [], provider: "ollama", model: "qwen", promptVersion: "v1", createdAt }
}

function planRow(value: ResumeContentPlan): any {
  return { ...value, resumePlan: { ...value, createdAt: value.createdAt.toISOString() } }
}

function curatedRow(): any {
  const evidence = { evidenceClaimId: "ev-1", knowledgeAssetId: "asset-1", subjectAssetId: "experience-1", subjectType: "professional_experience", claimType: "achievement", claimText: "Built systems", claimStatus: "confirmed", sources: [{ sourceDocumentId: "source-1", sourceReferenceId: "ref-1", excerpt: "private" }], objectiveSignals: { confidenceScore: 90, finalScore: 90, retrievalStrategies: ["structured"] } }
  const selection = { evidenceClaimId: "ev-1", reason: "Relevant", contribution: "Direct", exaggerationRisk: "low", evidence }
  return {
    id: "00000000-0000-4000-8000-000000000003",
    runIdentity: "run",
    jobDescriptionId: "00000000-0000-4000-8000-000000000002",
    jobAnalysisId: "00000000-0000-4000-8000-000000000004",
    candidatePackVersion: "candidate/v1",
    candidatePackHash: "hash",
    provider: "ollama",
    model: "qwen",
    promptVersion: "reason/v1",
    curatedEvidence: { overallCoverageSummary: "Strong", requirementCoverage: [{ requirementId: "req-1", requirementText: "TypeScript", importance: "required", coverageStatus: "strong", selectedEvidenceIds: ["ev-1"], rejectedCandidateEvidenceIds: [], selections: [selection], rejections: [], strengthFactors: [], limitations: [], explanation: "Supported" }], recommendedEvidence: [selection], discardedEvidence: [], missingEvidence: [], warnings: [], limitations: [] },
    createdAt: new Date("2026-07-21T09:00:00Z")
  }
}

function manifest(): ResumeArtifactManifest {
  return { schemaVersion: "resume-artifact-manifest/v1", artifactId: "00000000-0000-4000-8000-000000000010", renderingIdentity: "r".repeat(64), generationIdentity: "g".repeat(64), jobDescriptionId: plan().jobDescriptionId, jobAnalysisId: "00000000-0000-4000-8000-000000000004", curatedEvidencePackId: plan().curatedEvidencePackId, resumeContentPlanId: plan().id, format: "markdown", language: "en", length: "standard", templateId: "ats-clean-v1", templateVersion: "ats-clean-v1/1", rendererVersion: "resume-renderer/v1", artifactPath: "/tmp/resume.md", manifestPath: "/tmp/resume.md.manifest.json", mediaType: "text/markdown; charset=utf-8", checksum: "c".repeat(64), byteCount: 20, generatedAt: "2026-07-21T12:00:00.000Z", evidenceAccounting: { selectedEvidenceIds: ["ev-1"], omittedEvidence: [], contentReferences: [] }, candidateMetadataProvenance: [], requirementCoverage: [], knownGaps: { requirementIds: [], componentIds: [] }, validation: { renderable: true, meaningfulText: true }, alignment: { kind: "evidence-coverage", universalAtsScore: false } }
}

describe("Resume generation repositories and projections", () => {
  it("selects the latest valid compatible plan with stable repository ordering", async () => {
    const older = plan()
    const newer = plan("00000000-0000-4000-8000-000000000009", new Date("2026-07-21T11:00:00Z"))
    const db: any = { select: () => ({ from: (table: any) => { expect(table).toBe(resumeContentPlans); return { where: () => ({ orderBy: async () => [{ ...planRow(newer), resumePlan: { bad: true } }, planRow(older)] }) } } }) }
    await expect(new DrizzleResumeContentPlanRepository(db).findLatestCompatible({ jobDescriptionId: older.jobDescriptionId, language: "en", length: "standard", schemaVersions: ["resume-content-plan/v2"] })).resolves.toEqual(older)
  })

  it("loads exact pack provenance into a documents-owned source projection", async () => {
    const row = curatedRow()
    const db: any = { select: () => ({ from: (table: any) => { expect(table).toBe(curatedEvidencePacks); return { where: () => ({ limit: async () => [row] }) } } }) }
    const source = await new DrizzleResumeGenerationSourceReader(db).findById(row.id)
    expect(source).toMatchObject({ selectedEvidenceIds: ["ev-1"], sourceDocumentIds: ["source-1"], curatedEvidencePack: { id: row.id, jobAnalysisId: row.jobAnalysisId } })
    expect(JSON.stringify(source)).not.toContain("private")
  })

  it("projects candidate name precedence and evidence-backed optional sections from one profile", async () => {
    const documentRow = { id: "source-1", metadata: { name: "Explicit Name", email: "person@example.com", github: "github.com/person" }, ingestedAt: new Date("2026-07-21T10:00:00Z") }
    const profile = { id: "profile-1", sourceDocumentId: "source-1", assetType: "professional_profile", title: "Fallback Title", summary: null, createdAt: new Date("2026-07-21T10:00:00Z") }
    const education = { id: "education-1", sourceDocumentId: "source-1", assetType: "education", title: "BSc", summary: "University", createdAt: new Date("2026-07-21T10:00:00Z") }
    const claim = { id: "claim-1", subjectAssetId: "education-1", knowledgeAssetId: "education-1", sourceReferenceId: "ref-education", status: "confirmed" }
    const db: any = { select: () => ({ from: (table: any) => ({ where: () => table === sourceDocuments ? { orderBy: async () => [documentRow] } : Promise.resolve(table === knowledgeAssets ? [profile, education] : table === evidenceClaims ? [claim] : []) }) }) }
    const metadata = await new DrizzleCandidateResumeMetadataReader(db).read({ curatedEvidencePack: { id: "pack", jobDescriptionId: "job", requirementCoverage: [] }, selectedEvidenceIds: ["ev-1"], discardedEvidenceIds: [], sourceDocumentIds: ["source-1"] })
    expect(metadata).toMatchObject({ name: { value: "Explicit Name" }, email: { value: "person@example.com" }, education: [{ title: { value: "BSc" }, details: { value: "University" } }] })
    expect(metadata?.education[0].title.provenance[0]).toMatchObject({ sourceReferenceId: "ref-education", knowledgeAssetId: "education-1" })
  })

  it("persists immutable artifact metadata and returns the concurrent winner", async () => {
    const value = manifest()
    const row: any = { ...value, id: value.artifactId, jobAnalysisId: value.jobAnalysisId ?? null, pageCount: null, manifest: value, createdAt: new Date(value.generatedAt) }
    let insertWins = true
    const db: any = {
      insert: (table: any) => { expect(table).toBe(generatedResumeArtifacts); return { values: () => ({ onConflictDoNothing: () => ({ returning: async () => insertWins ? [row] : [] }) }) } },
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [row] }), limit: async () => [row] }) }) })
    }
    const repository = new DrizzleGeneratedResumeArtifactRepository(db)
    const artifact = { ...row, manifest: value }
    await expect(repository.save(artifact)).resolves.toMatchObject({ id: value.artifactId, renderingIdentity: value.renderingIdentity })
    insertWins = false
    await expect(repository.save({ ...artifact, id: "00000000-0000-4000-8000-000000000099" })).resolves.toMatchObject({ id: value.artifactId })
    await expect(repository.findLatestByRenderingIdentity(value.renderingIdentity)).resolves.toMatchObject({ generationIdentity: value.generationIdentity })
  })

  it("defines the additive artifact table and identity indexes in schema and migration", async () => {
    expect(generatedResumeArtifacts.generationIdentity).toBeDefined()
    const sql = await readFile("drizzle/0013_add_generated_resume_artifacts.sql", "utf8")
    expect(sql).toContain("generated_resume_artifacts_generation_identity_unique")
    expect(sql).toContain("resume_content_plan_id")
    expect(sql).toContain("manifest")
  })
})
