import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { freezeResumeGenerationInput, ResumeGenerationInput } from "../src/modules/documents/application/generation-input.js"
import { buildResumeGenerationIdentity, buildResumeRenderingIdentity, resumeFormatMetadata, sha256 } from "../src/modules/documents/application/resume-artifact-identity.js"
import { buildResumeDocument } from "../src/modules/documents/application/resume-document-builder.js"
import { ResumeGenerationValidationError } from "../src/modules/documents/application/resume-generation-validator.js"
import { ResumeGenerationObservability } from "../src/modules/documents/application/ports/resume-generation-observability.js"
import { CompatibleResumeContentPlanNotFoundError, CorruptCachedResumeArtifactError, createGenerateResumeUseCase } from "../src/modules/documents/application/use-cases/generate-resume.js"
import { GeneratedResumeArtifact, ResumeArtifactManifest } from "../src/modules/documents/domain/resume-document.js"
import { ResumeContentPlan } from "../src/modules/documents/domain/model.js"
import { HtmlResumeRenderer, escapeHtml } from "../src/modules/documents/infrastructure/renderers/html-resume-renderer.js"
import { MarkdownResumeRenderer, escapeMarkdown } from "../src/modules/documents/infrastructure/renderers/markdown-resume-renderer.js"
import { PdfResumeRenderer } from "../src/modules/documents/infrastructure/renderers/pdf-resume-renderer.js"
import { DefaultResumeRendererRegistry } from "../src/modules/documents/infrastructure/renderers/resume-renderer-registry.js"
import { LocalResumeArtifactStorage } from "../src/modules/documents/infrastructure/storage/local-resume-artifact-storage.js"

const ev1 = "00000000-0000-4000-8000-000000000101"
const ev2 = "00000000-0000-4000-8000-000000000102"

function plan(overrides: Partial<ResumeContentPlan> = {}): ResumeContentPlan {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    planIdentity: "a".repeat(64),
    schemaVersion: "resume-content-plan/v2",
    jobDescriptionId: "00000000-0000-4000-8000-000000000002",
    curatedEvidencePackId: "00000000-0000-4000-8000-000000000003",
    language: "en",
    length: "standard",
    professionalSummary: { text: "Builds reliable TypeScript & Node.js systems.", supportingEvidenceIds: [ev1] },
    plannedExperiences: [
      { sourceExperienceId: "older", role: "Engineer", organization: "Northstar", startDate: "2019-01", endDate: "2021-12", bullets: [{ text: "Built internal tooling.", supportingEvidenceIds: [ev2], targetRequirementIds: ["req-2"], sourceOrganizationOrExperienceId: "older", exaggerationRisk: "low", warnings: [] }] },
      { sourceExperienceId: "newer", role: "Senior Engineer", organization: "Acme", startDate: "2022-01", endDate: "Present", summary: { text: "Platform ownership.", supportingEvidenceIds: [ev1] }, bullets: [{ text: "Improved latency by 35%.", supportingEvidenceIds: [ev1], targetRequirementIds: ["req-1"], sourceOrganizationOrExperienceId: "newer", exaggerationRisk: "low", warnings: [] }] }
    ],
    plannedSkillGroups: [{ name: "Languages", skills: ["TypeScript", "Node.js"], supportingEvidenceIds: [ev1] }],
    selectedEvidenceIds: [ev1, ev2],
    omittedEvidence: [],
    uncoveredRequirementIds: ["req-gap"],
    uncoveredRequirementComponentIds: ["component-gap"],
    warnings: [],
    provider: "ollama",
    model: "qwen",
    promptVersion: "resume-planning/v7",
    createdAt: new Date("2026-07-21T12:00:00Z"),
    ...overrides
  }
}

function generationInput(planOverrides: Partial<ResumeContentPlan> = {}): ResumeGenerationInput {
  const resumePlan = plan(planOverrides)
  return {
    plan: resumePlan,
    source: {
      curatedEvidencePack: {
        id: resumePlan.curatedEvidencePackId,
        jobDescriptionId: resumePlan.jobDescriptionId,
        jobAnalysisId: "00000000-0000-4000-8000-000000000004",
        requirementCoverage: [{ requirementId: "req-1", coverageStatus: "strong", selectedEvidenceIds: [ev1], components: [{ componentId: "component-1", coverageStatus: "strong", selectedEvidenceIds: [ev1] }] }]
      },
      selectedEvidenceIds: [ev1, ev2],
      discardedEvidenceIds: [],
      sourceDocumentIds: ["source-1"]
    },
    candidate: {
      name: { value: "Mateus *Faria*", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] },
      headline: { value: "Staff Engineer", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] },
      email: { value: "mateus@example.com", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] },
      links: [{ label: "GitHub", value: "https://github.com/mateusfaria", provenance: [{ sourceDocumentId: "source-1", knowledgeAssetId: "profile-1" }] }],
      profileSourceDocumentId: "source-1",
      profileKnowledgeAssetId: "profile-1"
    }
  }
}

describe("ResumeDocument construction and deterministic renderers", () => {
  it("builds fixed ATS sections, reverse chronology, localized dates, and provenance", () => {
    const document = buildResumeDocument(freezeResumeGenerationInput(generationInput()))
    expect(document.experiences.map((item) => item.organization)).toEqual(["Acme", "Northstar"])
    expect(document.experiences[0]).toMatchObject({ startDate: "Jan 2022", endDate: "Present" })
    expect(document.education).toEqual([])
    expect(document.provenance).toMatchObject({ resumeContentPlanId: plan().id, selectedEvidenceIds: [ev1, ev2], jobAnalysisId: expect.any(String) })
  })

  it("uses Portuguese labels and omits empty optional sections", async () => {
    const input = generationInput({ language: "pt-BR", plannedSkillGroups: [], professionalSummary: { text: "Resumo comprovado.", supportingEvidenceIds: [ev1] } })
    const document = buildResumeDocument(input)
    const markdown = new TextDecoder().decode((await new MarkdownResumeRenderer().render(document)).bytes)
    expect(markdown).toContain("Resumo Profissional")
    expect(markdown).toContain("Experiência Profissional")
    expect(markdown).not.toContain("Competências Técnicas")
    expect(markdown).not.toContain("Formação Acadêmica")
  })

  it("rejects missing experience fields, placeholders, unknown evidence, and selected/omitted conflicts", () => {
    const invalid = generationInput({
      plannedExperiences: [{ sourceExperienceId: "x", role: "TBD", organization: undefined, startDate: "2020", endDate: "2021", bullets: [{ text: "Claim", supportingEvidenceIds: ["unknown"], targetRequirementIds: [], sourceOrganizationOrExperienceId: "x", exaggerationRisk: "low", warnings: [] }] }],
      omittedEvidence: [{ evidenceId: ev1, reason: "length", explanation: "Short" }]
    })
    expect(() => buildResumeDocument(invalid)).toThrow(ResumeGenerationValidationError)
    try { buildResumeDocument(invalid) } catch (error) {
      expect((error as ResumeGenerationValidationError).issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["empty_placeholder", "missing_required_field", "unknown_evidence_id", "selected_and_omitted"]))
    }
  })

  it("reports missing canonical name and missing renderable experience as independent issues", () => {
    const invalid = generationInput({ plannedExperiences: [] })
    delete invalid.candidate.name
    try {
      buildResumeDocument(invalid)
      throw new Error("Expected validation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(ResumeGenerationValidationError)
      expect((error as ResumeGenerationValidationError).issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "missing_candidate_name", path: "candidate.name" }),
        expect.objectContaining({ code: "missing_renderable_experience", path: "plan.plannedExperiences" })
      ]))
    }
  })

  it.each([
    { label: "candidate name", removeName: true, removeExperiences: false, expected: "missing_candidate_name", absent: "missing_renderable_experience" },
    { label: "renderable experience", removeName: false, removeExperiences: true, expected: "missing_renderable_experience", absent: "missing_candidate_name" }
  ])("reports only the $label issue when the other required input is valid", ({ removeName, removeExperiences, expected, absent }) => {
    const invalid = generationInput(removeExperiences ? { plannedExperiences: [] } : {})
    if (removeName) delete invalid.candidate.name
    try {
      buildResumeDocument(invalid)
      throw new Error("Expected validation to fail")
    } catch (error) {
      const codes = (error as ResumeGenerationValidationError).issues.map((issue) => issue.code)
      expect(codes).toContain(expected)
      expect(codes).not.toContain(absent)
    }
  })

  it("omits every optional Candidate field and keeps the resume body plan-bounded", () => {
    const input = generationInput()
    input.candidate = { name: input.candidate.name, links: [], profileSourceDocumentId: "source-1", profileKnowledgeAssetId: "profile-1" }
    const document = buildResumeDocument(input)
    expect(document.header).toEqual({ name: "Mateus *Faria*", links: [] })
    expect(document.education).toEqual([])
    expect(document.certifications).toEqual([])
    expect(JSON.stringify(document)).not.toContain("education-ref")
  })

  it("escapes Markdown and HTML and repeats byte-identically", async () => {
    expect(escapeMarkdown("A * B")).toBe("A \\* B")
    expect(escapeHtml("A < B & C")).toBe("A &lt; B &amp; C")
    const document = buildResumeDocument(generationInput())
    const markdown = new MarkdownResumeRenderer()
    const html = new HtmlResumeRenderer()
    const [md1, md2, html1, html2] = await Promise.all([markdown.render(document), markdown.render(document), html.render(document), html.render(document)])
    expect(md1.bytes).toEqual(md2.bytes)
    expect(html1.bytes).toEqual(html2.bytes)
    const htmlText = new TextDecoder().decode(html1.bytes)
    expect(htmlText).toContain("Mateus *Faria*")
    expect(htmlText).toContain("@page { size: A4")
    expect(htmlText).not.toMatch(/<script|@import|url\s*\(\s*https?:/u)
    expect(htmlText).not.toContain(ev1)
  })

  it("builds PDF from the same HTML through replaceable ports", async () => {
    const document = buildResumeDocument(generationInput())
    const converter = { convert: vi.fn(async (html: string) => { expect(html).toContain("Professional Experience"); return new TextEncoder().encode("%PDF-fake") }), close: vi.fn() }
    const inspector = { inspect: vi.fn(async () => ({ pageCount: 2, text: "Mateus Faria Professional Summary Technical Skills Professional Experience Education Improved latency" })) }
    const result = await new PdfResumeRenderer(new HtmlResumeRenderer(), converter, inspector).render(document)
    expect(result).toMatchObject({ format: "pdf", mediaType: "application/pdf", pageCount: 2 })
    expect(converter.convert).toHaveBeenCalledTimes(1)
  })
})

describe("Resume artifact identity and local storage", () => {
  const directories: string[] = []
  afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

  it("keeps paths and timestamps out of logical identity and makes force generations distinct", () => {
    const input = generationInput()
    const base = { plan: input.plan, candidate: input.candidate, format: "pdf" as const, language: "en" as const, length: "standard" as const, templateId: "ats-clean-v1" as const, templateVersion: "ats-clean-v1/1" }
    const identity = buildResumeRenderingIdentity(base)
    expect(buildResumeRenderingIdentity({ ...base })).toBe(identity)
    expect(buildResumeRenderingIdentity({ ...base, candidate: { ...input.candidate, name: { ...input.candidate.name!, value: "Changed Name" } } })).not.toBe(identity)
    expect(buildResumeGenerationIdentity(identity)).toBe(buildResumeGenerationIdentity(identity))
    expect(buildResumeGenerationIdentity(identity, "force-1")).not.toBe(buildResumeGenerationIdentity(identity, "force-2"))
  })

  it("writes artifact and manifest atomically, validates names, and materializes cached bytes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pke-resume-")); directories.push(directory)
    const storage = new LocalResumeArtifactStorage(directory)
    const defaultPath = storage.resolveOutputPath({ jobDescriptionId: "job/unsafe", language: "en", length: "standard", identity: "a".repeat(64), extension: ".md" })
    expect(defaultPath).toContain("job-unsafe")
    expect(() => storage.resolveOutputPath({ requestedPath: path.join(directory, "wrong.pdf"), jobDescriptionId: "job", language: "en", length: "standard", identity: "a", extension: ".md" })).toThrow("must use .md")
    const bytes = new TextEncoder().encode("resume")
    const stored = await storage.write({ outputPath: defaultPath, artifact: bytes, manifest: new TextEncoder().encode("{}\n"), force: false })
    expect(await readFile(stored.artifactPath, "utf8")).toBe("resume")
    const copied = await storage.materialize({ sourceArtifactPath: stored.artifactPath, sourceManifestPath: stored.manifestPath, outputPath: path.join(directory, "copy.md"), checksum: sha256(bytes), force: false })
    expect(await readFile(copied.artifactPath, "utf8")).toBe("resume")
    await expect(storage.materialize({ sourceArtifactPath: stored.artifactPath, sourceManifestPath: stored.manifestPath, outputPath: path.join(directory, "bad.md"), checksum: "bad", force: false })).rejects.toThrow("checksum mismatch")
  })

  it("rejects filesystem conflicts, supports force replacement, and leaves no temporary files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pke-resume-failure-")); directories.push(directory)
    const storage = new LocalResumeArtifactStorage(directory)
    const outputPath = path.join(directory, "resume.md")
    await storage.write({ outputPath, artifact: new TextEncoder().encode("first"), manifest: new TextEncoder().encode("{\"version\":1}"), force: false })
    await expect(storage.write({ outputPath, artifact: new TextEncoder().encode("second"), manifest: new TextEncoder().encode("{\"version\":2}"), force: false })).rejects.toThrow("Use --force")
    await storage.write({ outputPath, artifact: new TextEncoder().encode("second"), manifest: new TextEncoder().encode("{\"version\":2}"), force: true })
    expect(await readFile(outputPath, "utf8")).toBe("second")
    expect(await readFile(`${outputPath}.manifest.json`, "utf8")).toBe("{\"version\":2}")
    expect((await readdir(directory)).filter((name) => name.includes(".tmp-") || name.endsWith(".backup"))).toEqual([])

    const parentFile = path.join(directory, "not-a-directory")
    await writeFile(parentFile, "blocked")
    await expect(storage.write({ outputPath: path.join(parentFile, "resume.md"), artifact: new Uint8Array([1]), manifest: new Uint8Array([2]), force: false })).rejects.toBeDefined()
  })
})

describe("GenerateResume orchestration", () => {
  function harness(options: { missingPlan?: boolean; missingCandidate?: boolean; corruptCache?: boolean; storageFailure?: boolean; persistenceFailure?: boolean; telemetryFailure?: boolean; planOverrides?: Partial<ResumeContentPlan> } = {}) {
    const input = generationInput(options.planOverrides)
    const artifacts: GeneratedResumeArtifact[] = []
    const files = new Map<string, Uint8Array>()
    let id = 0
    const markdown = new MarkdownResumeRenderer()
    const render = vi.spyOn(markdown, "render")
    const html = new HtmlResumeRenderer()
    const pdf = new PdfResumeRenderer(
      html,
      { convert: vi.fn(async () => new TextEncoder().encode("%PDF-fake")), close: vi.fn() },
      { inspect: vi.fn(async () => ({ pageCount: 1, text: "Mateus Faria Professional Summary Technical Skills Professional Experience Education Improved latency" })) }
    )
    const remove = vi.fn(async ({ artifactPath, manifestPath }: any) => { files.delete(artifactPath); files.delete(manifestPath) })
    const storage = {
      resolveOutputPath: ({ requestedPath, identity, extension }: any) => requestedPath ?? `/artifacts/${identity.slice(0, 8)}${extension}`,
      write: vi.fn(async ({ outputPath, artifact, manifest }: any) => {
        if (options.storageFailure) throw new Error("filesystem unavailable")
        files.set(outputPath, artifact); files.set(`${outputPath}.manifest.json`, manifest)
        return { artifactPath: outputPath, manifestPath: `${outputPath}.manifest.json` }
      }),
      readArtifact: async (filePath: string) => options.corruptCache ? new TextEncoder().encode("corrupt") : files.get(filePath),
      materialize: vi.fn(async ({ sourceArtifactPath, sourceManifestPath, outputPath }: any) => { files.set(outputPath, files.get(sourceArtifactPath)!); files.set(`${outputPath}.manifest.json`, files.get(sourceManifestPath)!); return { artifactPath: outputPath, manifestPath: `${outputPath}.manifest.json` } }),
      remove
    }
    const save = vi.fn(async (artifact: GeneratedResumeArtifact) => {
      if (options.persistenceFailure) throw new Error("database unavailable")
      artifacts.push(artifact)
      return artifact
    })
    const observability: ResumeGenerationObservability | undefined = options.telemetryFailure ? {
      async run<T>(): Promise<T> { throw new Error("telemetry unavailable") },
      event(): void { throw new Error("telemetry unavailable") },
      record(): void { throw new Error("telemetry unavailable") }
    } : undefined
    const useCase = createGenerateResumeUseCase({
      planRepository: { findByPlanIdentity: vi.fn(), findLatestCompatible: vi.fn(async () => options.missingPlan ? undefined : input.plan), save: vi.fn() },
      sourceReader: { findById: vi.fn(async () => input.source) },
      candidateReader: { read: vi.fn(async () => options.missingCandidate ? { links: [] } : input.candidate) },
      artifactRepository: { findLatestByRenderingIdentity: vi.fn(async (identity) => artifacts.filter((item) => item.renderingIdentity === identity).at(-1)), save },
      storage,
      renderers: new DefaultResumeRendererRegistry([markdown, html, pdf]),
      observability,
      now: () => new Date("2026-07-21T15:00:00Z"),
      newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
      newRegenerationId: () => `force-${id}`
    })
    return { useCase, artifacts, render, save, storage, remove }
  }

  const command = { jobDescriptionId: plan().jobDescriptionId, format: "markdown" as const, language: "en" as const, length: "standard" as const, templateId: "ats-clean-v1" as const }

  it("generates, persists a provenance manifest, reuses, and force-regenerates", async () => {
    const { useCase, artifacts, render } = harness()
    const first = await useCase.execute(command)
    expect(first.reused).toBe(false)
    expect(first.artifact.manifest).toMatchObject({ alignment: { universalAtsScore: false }, knownGaps: { requirementIds: ["req-gap"] } })
    expect(first.artifact.manifest.evidenceAccounting.contentReferences.length).toBeGreaterThan(0)
    const reused = await useCase.execute(command)
    expect(reused.reused).toBe(true)
    expect(render).toHaveBeenCalledTimes(1)
    const forced = await useCase.execute({ ...command, force: true })
    expect(forced.reused).toBe(false)
    expect(render).toHaveBeenCalledTimes(2)
    expect(artifacts).toHaveLength(2)
    expect(artifacts[0].renderingIdentity).toBe(artifacts[1].renderingIdentity)
    expect(artifacts[0].generationIdentity).not.toBe(artifacts[1].generationIdentity)
  })

  it.each([
    { label: "missing canonical candidate name", options: { missingCandidate: true }, code: "missing_candidate_name" },
    { label: "missing renderable experience", options: { planOverrides: { plannedExperiences: [] } }, code: "missing_renderable_experience" }
  ])("writes no artifact for $label", async ({ options, code }) => {
    const { useCase, render, save, storage } = harness(options)
    await expect(useCase.execute(command)).rejects.toMatchObject({ issues: expect.arrayContaining([expect.objectContaining({ code })]) })
    expect(render).not.toHaveBeenCalled()
    expect(storage.write).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it("generates Markdown, HTML, and PDF through the selected renderer", async () => {
    for (const format of ["markdown", "html", "pdf"] as const) {
      const result = await harness().useCase.execute({ ...command, format })
      expect(result.artifact).toMatchObject({ format, mediaType: resumeFormatMetadata[format].mediaType })
      if (format === "pdf") expect(result.artifact.pageCount).toBe(1)
    }
  })

  it("fails actionably for a missing plan and rejects a corrupt cache", async () => {
    await expect(harness({ missingPlan: true }).useCase.execute(command)).rejects.toBeInstanceOf(CompatibleResumeContentPlanNotFoundError)
    const corrupt = harness({ corruptCache: true })
    await corrupt.useCase.execute(command)
    await expect(corrupt.useCase.execute(command)).rejects.toBeInstanceOf(CorruptCachedResumeArtifactError)
    await expect(corrupt.useCase.execute({ ...command, force: true })).resolves.toMatchObject({ reused: false })
  })

  it("rejects incompatible inputs before rendering", async () => {
    const incompatible = harness({ planOverrides: { language: "pt-BR" } })
    await expect(incompatible.useCase.execute(command)).rejects.toBeInstanceOf(ResumeGenerationValidationError)
    expect(incompatible.render).not.toHaveBeenCalled()
  })

  it("does not persist storage failures and cleans files after persistence failures", async () => {
    const storageFailure = harness({ storageFailure: true })
    await expect(storageFailure.useCase.execute(command)).rejects.toThrow("filesystem unavailable")
    expect(storageFailure.save).not.toHaveBeenCalled()

    const persistenceFailure = harness({ persistenceFailure: true })
    await expect(persistenceFailure.useCase.execute(command)).rejects.toThrow("database unavailable")
    expect(persistenceFailure.remove).toHaveBeenCalledTimes(1)
  })

  it("materializes custom output without changing logical identity and fails open when telemetry throws", async () => {
    const normal = harness()
    const baseline = await normal.useCase.execute(command)
    const custom = await normal.useCase.execute({ ...command, outputPath: "/exports/custom.md" })
    expect(custom).toMatchObject({ reused: true, outputPath: "/exports/custom.md", artifact: { renderingIdentity: baseline.artifact.renderingIdentity } })
    expect(normal.storage.materialize).toHaveBeenCalledTimes(1)

    await expect(harness({ telemetryFailure: true }).useCase.execute(command)).resolves.toMatchObject({ reused: false })
  })

  it("reports every long-running stage without making progress callbacks authoritative", async () => {
    const stages: string[] = []
    const { useCase } = harness()
    await expect(useCase.execute({ ...command, onProgress: (stage) => { stages.push(stage); if (stage === "loading_candidate") throw new Error("terminal") } })).resolves.toBeDefined()
    expect(stages).toEqual(expect.arrayContaining(["loading_plan", "loading_provenance", "loading_candidate", "building_document", "rendering_markdown", "writing_output", "persisting_artifact"]))
  })
})
