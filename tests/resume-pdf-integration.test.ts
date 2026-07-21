import { afterAll, describe, expect, it } from "vitest"

import { ResumeGenerationInput } from "../src/modules/documents/application/generation-input.js"
import { buildResumeDocument } from "../src/modules/documents/application/resume-document-builder.js"
import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { PlaywrightHtmlToPdfConverter } from "../src/modules/documents/infrastructure/pdf/playwright-html-to-pdf-converter.js"
import { PdfJsInspector } from "../src/modules/documents/infrastructure/pdf/pdfjs-inspector.js"
import { HtmlResumeRenderer } from "../src/modules/documents/infrastructure/renderers/html-resume-renderer.js"
import { PdfResumeRenderer } from "../src/modules/documents/infrastructure/renderers/pdf-resume-renderer.js"

const evidenceId = "00000000-0000-4000-8000-000000000101"

async function annotationUrls(bytes: Uint8Array): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loading = getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false })
  const document = await loading.promise
  try {
    const annotations = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => (await document.getPage(index + 1)).getAnnotations()))
    return annotations.flat().flatMap((annotation) => typeof annotation.url === "string" ? [annotation.url] : [])
  } finally { await document.cleanup(); await loading.destroy() }
}

function input(bulletCount: number): ResumeGenerationInput {
  const bullets = Array.from({ length: bulletCount }, (_, index) => ({
    text: `Achievement ${index + 1}: designed and delivered reliable TypeScript platform capabilities with deterministic validation, operational telemetry, documented ownership boundaries, and measurable improvements for internal engineering teams. Coordinated architecture reviews, incremental rollout, production verification, incident follow-up, and maintainable handoff documentation across partner teams while preserving evidence-backed scope and clear operational accountability.`,
    supportingEvidenceIds: [evidenceId],
    targetRequirementIds: ["req-1"],
    sourceOrganizationOrExperienceId: "experience-1",
    exaggerationRisk: "low" as const,
    warnings: []
  }))
  const plan: ResumeContentPlan = {
    id: "00000000-0000-4000-8000-000000000001",
    planIdentity: "a".repeat(64),
    schemaVersion: "resume-content-plan/v2",
    jobDescriptionId: "00000000-0000-4000-8000-000000000002",
    curatedEvidencePackId: "00000000-0000-4000-8000-000000000003",
    language: "en",
    length: bulletCount > 4 ? "detailed" : "concise",
    professionalSummary: { text: "Senior software engineer focused on reliable local-first knowledge systems.", supportingEvidenceIds: [evidenceId] },
    plannedExperiences: [{ sourceExperienceId: "experience-1", role: "Senior Software Engineer", organization: "Acme Systems", startDate: "2020-01", endDate: "Present", bullets }],
    plannedSkillGroups: [{ name: "Core", skills: ["TypeScript", "Node.js", "PostgreSQL", "OpenTelemetry"], supportingEvidenceIds: [evidenceId] }],
    selectedEvidenceIds: [evidenceId], omittedEvidence: [], uncoveredRequirementIds: ["req-gap"], warnings: [], provider: "ollama", model: "qwen", promptVersion: "v1", createdAt: new Date("2026-07-21T10:00:00Z")
  }
  return {
    plan,
    source: { curatedEvidencePack: { id: plan.curatedEvidencePackId, jobDescriptionId: plan.jobDescriptionId, requirementCoverage: [] }, selectedEvidenceIds: [evidenceId], discardedEvidenceIds: [], sourceDocumentIds: ["source-1"] },
    candidate: { name: { value: "Mateus Faria", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] }, email: { value: "mateus@example.com", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] }, links: [{ label: "GitHub", value: "https://github.com/mateusfaria", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] }], profileSourceDocumentId: "source-1", profileKnowledgeAssetId: "profile-1" }
  }
}

describe.sequential("real ATS PDF rendering", () => {
  const converter = new PlaywrightHtmlToPdfConverter()
  const inspector = new PdfJsInspector()
  const renderer = new PdfResumeRenderer(new HtmlResumeRenderer(), converter, inspector)

  afterAll(async () => { await converter.close() })

  it("creates a readable one-page PDF with selectable text", async () => {
    const result = await renderer.render(buildResumeDocument(input(2)))
    expect(Buffer.from(result.bytes.slice(0, 4)).toString("ascii")).toBe("%PDF")
    expect(result.pageCount).toBe(1)
    expect(result.extractedText).toContain("Mateus Faria")
    expect(result.extractedText).toContain("PROFESSIONAL EXPERIENCE")
    expect(result.extractedText).toContain("Achievement 2")
  }, 30_000)

  it("flows a detailed resume across pages without losing first or last content", async () => {
    const result = await renderer.render(buildResumeDocument(input(12)))
    expect(result.pageCount).toBeGreaterThan(1)
    expect(result.extractedText).toContain("Achievement 1")
    expect(result.extractedText).toContain("Achievement 12")
    expect(await annotationUrls(result.bytes)).toContain("https://github.com/mateusfaria")
  }, 30_000)
})
