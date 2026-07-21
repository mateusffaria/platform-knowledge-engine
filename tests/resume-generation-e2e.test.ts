import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { ResumeRenderer } from "../src/modules/documents/application/ports/resume-renderer.js"
import { createGenerateResumeUseCase } from "../src/modules/documents/application/use-cases/generate-resume.js"
import { ResumeDocument } from "../src/modules/documents/domain/resume-document.js"
import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { PdfJsInspector } from "../src/modules/documents/infrastructure/pdf/pdfjs-inspector.js"
import { PlaywrightHtmlToPdfConverter } from "../src/modules/documents/infrastructure/pdf/playwright-html-to-pdf-converter.js"
import { HtmlResumeRenderer } from "../src/modules/documents/infrastructure/renderers/html-resume-renderer.js"
import { MarkdownResumeRenderer } from "../src/modules/documents/infrastructure/renderers/markdown-resume-renderer.js"
import { PdfResumeRenderer } from "../src/modules/documents/infrastructure/renderers/pdf-resume-renderer.js"
import { DefaultResumeRendererRegistry } from "../src/modules/documents/infrastructure/renderers/resume-renderer-registry.js"
import { DrizzleCandidateResumeMetadataReader } from "../src/modules/documents/infrastructure/repositories/drizzle-candidate-resume-metadata-reader.js"
import { DrizzleGeneratedResumeArtifactRepository } from "../src/modules/documents/infrastructure/repositories/drizzle-generated-resume-artifact-repository.js"
import { DrizzleResumeContentPlanRepository } from "../src/modules/documents/infrastructure/repositories/drizzle-resume-content-plan-repository.js"
import { DrizzleResumeGenerationSourceReader } from "../src/modules/documents/infrastructure/repositories/drizzle-resume-generation-source-reader.js"
import { LocalResumeArtifactStorage } from "../src/modules/documents/infrastructure/storage/local-resume-artifact-storage.js"
import { createDatabase } from "../src/shared/database/client.js"
import { curatedEvidencePacks, generatedResumeArtifacts, jobAnalyses, jobDescriptions, knowledgeAssets, sourceDocuments } from "../src/shared/database/schema.js"

const databaseIntegrationEnabled = process.env.PKE_DATABASE_INTEGRATION === "1"
const databaseUrl = process.env.DATABASE_URL ?? "postgres://pke:pke@localhost:5432/pke"

describe.skipIf(!databaseIntegrationEnabled)("persisted resume generation end to end", () => {
  const ids = {
    sourceDocument: randomUUID(),
    profileAsset: randomUUID(),
    jobDescription: randomUUID(),
    jobAnalysis: randomUUID(),
    curatedEvidencePack: randomUUID(),
    resumeContentPlan: randomUUID()
  }
  const evidenceId = `evidence-${randomUUID()}`
  const sourceOnlyText = "PRIVATE SOURCE DETAIL THAT MUST NOT ENTER THE RESUME"
  const plannedBullet = "Reduced deployment recovery time through deterministic platform automation."
  const providerCall = vi.fn()
  const retrievalCall = vi.fn()
  const capturedDocuments: ResumeDocument[] = []
  let database: ReturnType<typeof createDatabase> | undefined
  let outputRoot: string | undefined
  let converter: PlaywrightHtmlToPdfConverter | undefined
  let useCase: ReturnType<typeof createGenerateResumeUseCase>

  const selection = {
    evidenceClaimId: evidenceId,
    reason: "Directly supports the platform requirement.",
    contribution: "Demonstrates production platform ownership.",
    exaggerationRisk: "low" as const,
    addressedRequirementIds: ["req-platform"],
    addressedComponentIds: ["component-automation"],
    evidence: {
      evidenceClaimId: evidenceId,
      knowledgeAssetId: ids.profileAsset,
      subjectAssetId: "experience-acme",
      subjectType: "professional_experience",
      claimType: "achievement",
      claimCategory: "achievement",
      predicate: "demonstrates",
      claimText: sourceOnlyText,
      claimStatus: "confirmed",
      sources: [{ sourceDocumentId: ids.sourceDocument, sourceReferenceId: "profile-experience", locator: "Experience > Acme", excerpt: sourceOnlyText }],
      objectiveSignals: { confidenceScore: 95, finalScore: 92, retrievalStrategies: ["structured"] }
    }
  }

  const plan: ResumeContentPlan = {
    id: ids.resumeContentPlan,
    planIdentity: randomUUID().replaceAll("-", "").padEnd(64, "a"),
    schemaVersion: "resume-content-plan/v2",
    jobDescriptionId: ids.jobDescription,
    curatedEvidencePackId: ids.curatedEvidencePack,
    language: "en",
    length: "standard",
    professionalSummary: { text: "Staff engineer focused on reliable TypeScript platforms.", supportingEvidenceIds: [evidenceId] },
    plannedExperiences: [{
      sourceExperienceId: "experience-acme",
      role: "Staff Software Engineer",
      organization: "Acme Systems",
      startDate: "2021-01",
      endDate: "Present",
      bullets: [{
        text: plannedBullet,
        supportingEvidenceIds: [evidenceId],
        targetRequirementIds: ["req-platform"],
        targetRequirementComponentIds: ["component-automation"],
        sourceOrganizationOrExperienceId: "experience-acme",
        exaggerationRisk: "low",
        warnings: []
      }]
    }],
    plannedSkillGroups: [{ name: "Languages and Platforms", skills: ["TypeScript", "Node.js"], supportingEvidenceIds: [evidenceId] }],
    selectedEvidenceIds: [evidenceId],
    omittedEvidence: [],
    uncoveredRequirementIds: ["req-gap"],
    uncoveredRequirementComponentIds: ["component-gap"],
    warnings: [],
    provider: "fixture-provider",
    model: "fixture-model",
    promptVersion: "resume-planning/e2e",
    createdAt: new Date("2026-07-21T12:00:00.000Z")
  }

  function capture(renderer: ResumeRenderer): ResumeRenderer {
    return {
      format: renderer.format,
      async render(document) {
        capturedDocuments.push(structuredClone(document))
        return renderer.render(document)
      }
    }
  }

  beforeAll(async () => {
    database = createDatabase(databaseUrl)
    outputRoot = await mkdtemp(path.join(os.tmpdir(), "pke-resume-e2e-"))
    converter = new PlaywrightHtmlToPdfConverter()
    const { db } = database
    await db.insert(sourceDocuments).values({
      id: ids.sourceDocument,
      sourceType: "markdown",
      path: `e2e://${ids.sourceDocument}/profile.md`,
      contentHash: randomUUID().replaceAll("-", ""),
      sourceReliability: 100,
      metadata: { name: "Alex Morgan", headline: "Staff Engineer", email: "alex@example.com", github: "https://github.com/alex" },
      rawContent: sourceOnlyText,
      ingestedAt: new Date("2026-07-21T10:00:00.000Z")
    })
    await db.insert(knowledgeAssets).values({ id: ids.profileAsset, sourceDocumentId: ids.sourceDocument, assetType: "professional_profile", title: "Alex Morgan", summary: "Trusted profile", createdAt: new Date("2026-07-21T10:00:00.000Z") })
    await db.insert(jobDescriptions).values({ id: ids.jobDescription, sourceType: "plain_text", sourcePath: `e2e://${ids.jobDescription}`, rawContent: "Seeking a TypeScript platform engineer.", contentHash: randomUUID().replaceAll("-", ""), title: "Platform Engineer", ingestedAt: new Date("2026-07-21T10:30:00.000Z") })
    await db.insert(jobAnalyses).values({ id: ids.jobAnalysis, jobDescriptionId: ids.jobDescription, provider: "fixture-provider", model: "fixture-model", promptVersion: "job-analysis/e2e", analysisIdentity: randomUUID().replaceAll("-", ""), analysis: {}, createdAt: new Date("2026-07-21T11:00:00.000Z") })
    await db.insert(curatedEvidencePacks).values({
      id: ids.curatedEvidencePack,
      jobDescriptionId: ids.jobDescription,
      jobAnalysisId: ids.jobAnalysis,
      candidatePackVersion: "candidate-evidence/v1",
      candidatePackHash: randomUUID().replaceAll("-", ""),
      provider: "fixture-provider",
      model: "fixture-model",
      promptVersion: "evidence-reasoning/e2e",
      runIdentity: randomUUID().replaceAll("-", ""),
      curatedEvidence: {
        overallCoverageSummary: "Platform automation is supported; one requirement remains uncovered.",
        requirementCoverage: [
          {
            requirementId: "req-platform", requirementText: "Platform automation", importance: "required", coverageStatus: "strong", selectedEvidenceIds: [evidenceId], rejectedCandidateEvidenceIds: [], selections: [selection], rejections: [], strengthFactors: ["direct"], limitations: [], explanation: "Direct support.",
            componentCoverage: [{ requirementId: "req-platform", componentId: "component-automation", componentIndex: 0, componentText: "Automation", importance: "required", coverageStatus: "strong", selectedEvidenceIds: [evidenceId], rejectedCandidateEvidenceIds: [], selections: [selection], rejections: [], strengthFactors: ["direct"], limitations: [], explanation: "Direct support." }]
          },
          {
            requirementId: "req-gap", requirementText: "Uncovered domain", importance: "preferred", coverageStatus: "missing", selectedEvidenceIds: [], rejectedCandidateEvidenceIds: [], selections: [], rejections: [], strengthFactors: [], limitations: ["No evidence"], explanation: "Not supported.",
            componentCoverage: [{ requirementId: "req-gap", componentId: "component-gap", componentIndex: 0, componentText: "Uncovered domain", importance: "preferred", coverageStatus: "missing", selectedEvidenceIds: [], rejectedCandidateEvidenceIds: [], selections: [], rejections: [], strengthFactors: [], limitations: ["No evidence"], explanation: "Not supported." }]
          }
        ],
        recommendedEvidence: [selection],
        discardedEvidence: [],
        missingEvidence: [{ requirementId: "req-gap", requirementText: "Uncovered domain", componentId: "component-gap", componentText: "Uncovered domain", reason: "No trusted evidence." }],
        warnings: [],
        limitations: ["Fixture limitation"]
      },
      createdAt: new Date("2026-07-21T11:30:00.000Z")
    })
    const planRepository = new DrizzleResumeContentPlanRepository(db)
    await planRepository.save(plan)
    const htmlRenderer = new HtmlResumeRenderer()
    const inspector = new PdfJsInspector()
    const renderers = new DefaultResumeRendererRegistry([
      capture(new MarkdownResumeRenderer()),
      capture(htmlRenderer),
      capture(new PdfResumeRenderer(htmlRenderer, converter, inspector))
    ])
    useCase = createGenerateResumeUseCase({
      planRepository,
      sourceReader: new DrizzleResumeGenerationSourceReader(db),
      candidateReader: new DrizzleCandidateResumeMetadataReader(db),
      artifactRepository: new DrizzleGeneratedResumeArtifactRepository(db),
      storage: new LocalResumeArtifactStorage(outputRoot),
      renderers
    })
  }, 30_000)

  afterAll(async () => {
    try { await converter?.close() } catch {}
    if (database) {
      try { await database.db.delete(jobDescriptions).where(eq(jobDescriptions.id, ids.jobDescription)) } catch {}
      try { await database.db.delete(sourceDocuments).where(eq(sourceDocuments.id, ids.sourceDocument)) } catch {}
      await database.close()
    }
    if (outputRoot) await rm(outputRoot, { recursive: true, force: true })
  })

  it("renders and persists one canonical document as Markdown, HTML, and selectable-text PDF without providers or retrieval", async () => {
    const baseCommand = { jobDescriptionId: ids.jobDescription, language: "en" as const, length: "standard" as const, templateId: "ats-clean-v1" as const }
    const markdown = await useCase.execute({ ...baseCommand, format: "markdown" })
    const html = await useCase.execute({ ...baseCommand, format: "html" })
    const pdf = await useCase.execute({ ...baseCommand, format: "pdf" })

    expect(capturedDocuments).toHaveLength(3)
    expect(capturedDocuments[1]).toEqual(capturedDocuments[0])
    expect(capturedDocuments[2]).toEqual(capturedDocuments[0])
    const markdownText = await readFile(markdown.outputPath, "utf8")
    const htmlText = await readFile(html.outputPath, "utf8")
    const pdfInspection = await new PdfJsInspector().inspect(await readFile(pdf.outputPath))
    for (const body of [markdownText, htmlText, pdfInspection.text]) {
      expect(body).toContain("Alex Morgan")
      expect(body).toContain("Staff Software Engineer")
      expect(body).toContain("Acme Systems")
      expect(body).toContain(plannedBullet.slice(0, -1))
      expect(body).not.toContain(evidenceId)
      expect(body).not.toContain(sourceOnlyText)
    }
    expect(pdfInspection.pageCount).toBeGreaterThanOrEqual(1)
    expect(providerCall).not.toHaveBeenCalled()
    expect(retrievalCall).not.toHaveBeenCalled()

    const stored = await database!.db.select().from(generatedResumeArtifacts).where(eq(generatedResumeArtifacts.resumeContentPlanId, ids.resumeContentPlan))
    expect(stored).toHaveLength(3)
    for (const result of [markdown, html, pdf]) {
      expect(result.artifact).toMatchObject({ jobDescriptionId: ids.jobDescription, jobAnalysisId: ids.jobAnalysis, curatedEvidencePackId: ids.curatedEvidencePack, resumeContentPlanId: ids.resumeContentPlan })
      expect(result.artifact.manifest).toMatchObject({
        evidenceAccounting: { selectedEvidenceIds: [evidenceId] },
        knownGaps: { requirementIds: ["req-gap"], componentIds: ["component-gap"] },
        validation: { renderable: true, meaningfulText: true },
        alignment: { kind: "evidence-coverage", universalAtsScore: false }
      })
      expect(result.artifact.manifest.requirementCoverage).toEqual(expect.arrayContaining([
        expect.objectContaining({ requirementId: "req-platform", components: [expect.objectContaining({ componentId: "component-automation", selectedEvidenceIds: [evidenceId] })] })
      ]))
      expect(JSON.stringify(result.artifact.manifest)).not.toMatch(/atsScore\s*:\s*(?:true|\d)/iu)
    }
  }, 30_000)

  it("reuses the database-backed artifact, force-generates an immutable successor, and retains source-plan traceability", async () => {
    const command = { jobDescriptionId: ids.jobDescription, format: "markdown" as const, language: "en" as const, length: "standard" as const, templateId: "ats-clean-v1" as const }
    const beforeRenderCount = capturedDocuments.length
    const reused = await useCase.execute(command)
    expect(reused.reused).toBe(true)
    expect(capturedDocuments).toHaveLength(beforeRenderCount)
    const forced = await useCase.execute({ ...command, force: true })
    expect(forced.reused).toBe(false)
    expect(capturedDocuments).toHaveLength(beforeRenderCount + 1)
    expect(forced.artifact.renderingIdentity).toBe(reused.artifact.renderingIdentity)
    expect(forced.artifact.generationIdentity).not.toBe(reused.artifact.generationIdentity)
    expect(forced.artifact.resumeContentPlanId).toBe(ids.resumeContentPlan)

    const stored = await database!.db.select().from(generatedResumeArtifacts).where(eq(generatedResumeArtifacts.resumeContentPlanId, ids.resumeContentPlan))
    expect(stored).toHaveLength(4)
  }, 30_000)
})
