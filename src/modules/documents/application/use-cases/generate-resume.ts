import { randomUUID } from "node:crypto"

import { buildResumeArtifactManifest, artifactFromManifest } from "../resume-artifact-manifest.js"
import { buildResumeGenerationIdentity, buildResumeRenderingIdentity, resumeFormatMetadata, sha256 } from "../resume-artifact-identity.js"
import { buildResumeDocument } from "../resume-document-builder.js"
import { assertCompatibleResumePlan } from "../resume-generation-validator.js"
import { freezeResumeGenerationInput } from "../generation-input.js"
import { CandidateResumeMetadataReader } from "../ports/candidate-resume-metadata-reader.js"
import { GeneratedResumeArtifactRepository } from "../ports/generated-resume-artifact-repository.js"
import { ResumeArtifactStorage } from "../ports/resume-artifact-storage.js"
import { ResumeContentPlanRepository } from "../ports/resume-content-plan-repository.js"
import { FailOpenResumeGenerationObservability, NoopResumeGenerationObservability, ResumeGenerationObservability } from "../ports/resume-generation-observability.js"
import { ResumeGenerationSourceReader } from "../ports/resume-generation-source-reader.js"
import { ResumeRendererRegistry } from "../ports/resume-renderer.js"
import { atsCleanTemplateVersion, GenerateResumeResult, ResumeFormat, resumeRendererVersion, ResumeTemplateId, supportedResumePlanSchemaVersions } from "../../domain/resume-document.js"
import { ResumeLanguage, ResumeLength } from "../../domain/model.js"

export type ResumeGenerationProgressStage =
  | "loading_plan"
  | "loading_provenance"
  | "loading_candidate"
  | "validating_input"
  | "checking_existing_artifact"
  | "building_document"
  | "rendering_markdown"
  | "rendering_html"
  | "rendering_pdf"
  | "validating_artifact"
  | "writing_output"
  | "persisting_artifact"
  | "reusing_artifact"

export interface GenerateResumeCommand {
  jobDescriptionId: string
  format: ResumeFormat
  language: ResumeLanguage
  length: ResumeLength
  templateId: ResumeTemplateId
  outputPath?: string
  force?: boolean
  onProgress?: (stage: ResumeGenerationProgressStage) => void
}

export interface GenerateResumeDependencies {
  planRepository: ResumeContentPlanRepository
  sourceReader: ResumeGenerationSourceReader
  candidateReader: CandidateResumeMetadataReader
  artifactRepository: GeneratedResumeArtifactRepository
  storage: ResumeArtifactStorage
  renderers: ResumeRendererRegistry
  observability?: ResumeGenerationObservability
  now?: () => Date
  newId?: () => string
  newRegenerationId?: () => string
}

export class CompatibleResumeContentPlanNotFoundError extends Error {
  constructor(command: Pick<GenerateResumeCommand, "jobDescriptionId" | "language" | "length">) {
    super(`No compatible Resume Content Plan was found for job ${command.jobDescriptionId}, language ${command.language}, and length ${command.length}. Run pke documents resume plan ${command.jobDescriptionId} --language ${command.language} --length ${command.length} first.`)
    this.name = "CompatibleResumeContentPlanNotFoundError"
  }
}

export class ResumeGenerationSourceNotFoundError extends Error {
  constructor(id: string) { super(`The Curated Evidence Pack ${id} referenced by the Resume Content Plan is missing or incompatible.`); this.name = "ResumeGenerationSourceNotFoundError" }
}

export class CandidateResumeMetadataNotFoundError extends Error {
  constructor() { super("Trusted candidate presentation metadata could not be loaded. Ingest a profile with an explicit name and evidence-backed experience first."); this.name = "CandidateResumeMetadataNotFoundError" }
}

export class CorruptCachedResumeArtifactError extends Error {
  constructor(filePath: string) { super(`Cached resume artifact is missing or has an invalid checksum: ${filePath}. Re-run with --force.`); this.name = "CorruptCachedResumeArtifactError" }
}

function progress(command: GenerateResumeCommand, stage: ResumeGenerationProgressStage): void {
  try { command.onProgress?.(stage) } catch {}
}

export function createGenerateResumeUseCase(dependencies: GenerateResumeDependencies) {
  const observability = new FailOpenResumeGenerationObservability(dependencies.observability ?? new NoopResumeGenerationObservability())
  const now = dependencies.now ?? (() => new Date())
  const newId = dependencies.newId ?? randomUUID
  const newRegenerationId = dependencies.newRegenerationId ?? randomUUID
  return {
    async execute(command: GenerateResumeCommand): Promise<GenerateResumeResult> {
      const rootAttributes = { jobDescriptionId: command.jobDescriptionId, format: command.format, language: command.language, length: command.length, templateId: command.templateId }
      const startedAt = performance.now()
      let outcome = "failure"
      try {
        return await observability.run("documents.resume.generate", rootAttributes, async () => {
          progress(command, "loading_plan")
          const plan = await observability.run("load-plan", rootAttributes, () => dependencies.planRepository.findLatestCompatible({ jobDescriptionId: command.jobDescriptionId, language: command.language, length: command.length, schemaVersions: supportedResumePlanSchemaVersions }))
          if (!plan) throw new CompatibleResumeContentPlanNotFoundError(command)
          assertCompatibleResumePlan(plan, command)
          progress(command, "loading_provenance")
          const source = await observability.run("load-provenance", { resumeContentPlanId: plan.id }, () => dependencies.sourceReader.findById(plan.curatedEvidencePackId))
          if (!source) throw new ResumeGenerationSourceNotFoundError(plan.curatedEvidencePackId)
          progress(command, "loading_candidate")
          const candidate = await observability.run("load-candidate", { resumeContentPlanId: plan.id }, () => dependencies.candidateReader.read(source))
          if (!candidate) throw new CandidateResumeMetadataNotFoundError()
          const input = freezeResumeGenerationInput({ plan, source, candidate })
          const renderingIdentity = buildResumeRenderingIdentity({ plan, candidate, format: command.format, language: command.language, length: command.length, templateId: command.templateId, templateVersion: atsCleanTemplateVersion })
          const generationIdentity = buildResumeGenerationIdentity(renderingIdentity, command.force ? newRegenerationId() : undefined)
          const formatMetadata = resumeFormatMetadata[command.format]
          progress(command, "checking_existing_artifact")
          if (!command.force) {
            const existing = await dependencies.artifactRepository.findLatestByRenderingIdentity(renderingIdentity)
            if (existing) {
              const cached = await dependencies.storage.readArtifact(existing.artifactPath)
              if (!cached || sha256(cached) !== existing.checksum) throw new CorruptCachedResumeArtifactError(existing.artifactPath)
              const requestedOutput = command.outputPath ? dependencies.storage.resolveOutputPath({ requestedPath: command.outputPath, jobDescriptionId: command.jobDescriptionId, language: command.language, length: command.length, identity: existing.generationIdentity, extension: formatMetadata.extension }) : existing.artifactPath
              progress(command, "reusing_artifact")
              const materialized = requestedOutput === existing.artifactPath
                ? { artifactPath: existing.artifactPath, manifestPath: existing.manifestPath }
                : await dependencies.storage.materialize({ sourceArtifactPath: existing.artifactPath, sourceManifestPath: existing.manifestPath, outputPath: requestedOutput, checksum: existing.checksum, force: false })
              observability.event("resume_artifact_reused", { artifactId: existing.id, renderingIdentity })
              observability.record("cacheHits", 1, { format: command.format })
              outcome = "cache_hit"
              return { artifact: existing, outputPath: materialized.artifactPath, manifestPath: materialized.manifestPath, reused: true, selectedEvidenceCount: plan.selectedEvidenceIds.length }
            }
          }
          progress(command, "validating_input")
          progress(command, "building_document")
          const document = await observability.run("build-document", { resumeContentPlanId: plan.id }, async () => buildResumeDocument(input))
          const renderer = dependencies.renderers.get(command.format)
          progress(command, command.format === "pdf" ? "rendering_pdf" : command.format === "html" ? "rendering_html" : "rendering_markdown")
          const renderStartedAt = performance.now()
          const rendered = await observability.run(`render-${command.format}`, { renderingIdentity }, () => renderer.render(document))
          observability.record("renderingDuration", performance.now() - renderStartedAt, { format: command.format })
          progress(command, "validating_artifact")
          const checksum = sha256(rendered.bytes)
          const artifactId = newId()
          const generatedAt = now()
          const outputPath = dependencies.storage.resolveOutputPath({ jobDescriptionId: command.jobDescriptionId, language: command.language, length: command.length, identity: `${artifactId.replaceAll("-", "")}-${generationIdentity}`, extension: formatMetadata.extension })
          const manifestPath = `${outputPath}.manifest.json`
          const manifest = buildResumeArtifactManifest({ id: artifactId, renderingIdentity, generationIdentity, generationInput: input, document, rendered, artifactPath: outputPath, manifestPath, checksum, generatedAt })
          progress(command, "writing_output")
          const storedFiles = await observability.run("write-output", { renderingIdentity, outputPath }, () => dependencies.storage.write({ outputPath, artifact: rendered.bytes, manifest: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`), force: command.force === true }))
          const artifact = artifactFromManifest({ ...manifest, artifactPath: storedFiles.artifactPath, manifestPath: storedFiles.manifestPath })
          progress(command, "persisting_artifact")
          let persisted
          try {
            persisted = await observability.run("persist-artifact", { artifactId, renderingIdentity }, () => dependencies.artifactRepository.save(artifact))
          } catch (error) {
            try { await dependencies.storage.remove(storedFiles) } catch {}
            throw error
          }
          if (persisted.id !== artifact.id) await dependencies.storage.remove(storedFiles)
          const requestedOutput = command.outputPath ? dependencies.storage.resolveOutputPath({ requestedPath: command.outputPath, jobDescriptionId: command.jobDescriptionId, language: command.language, length: command.length, identity: persisted.generationIdentity, extension: formatMetadata.extension }) : persisted.artifactPath
          const deliveredFiles = requestedOutput === persisted.artifactPath
            ? { artifactPath: persisted.artifactPath, manifestPath: persisted.manifestPath }
            : await dependencies.storage.materialize({ sourceArtifactPath: persisted.artifactPath, sourceManifestPath: persisted.manifestPath, outputPath: requestedOutput, checksum: persisted.checksum, force: command.force === true })
          observability.record("outputSize", rendered.bytes.byteLength, { format: command.format })
          if (rendered.pageCount) observability.record("pageCount", rendered.pageCount, { format: command.format })
          observability.record("evidenceCount", plan.selectedEvidenceIds.length, { format: command.format })
          observability.record("sectionCount", 2 + Number(Boolean(document.professionalSummary)) + Number(document.skillGroups.length > 0) + Number(document.education.length > 0) + Number(document.certifications.length > 0), { format: command.format })
          observability.event("resume_artifact_generated", { artifactId: persisted.id, renderingIdentity, outputPath: deliveredFiles.artifactPath, format: command.format })
          outcome = "success"
          return { artifact: persisted, outputPath: deliveredFiles.artifactPath, manifestPath: deliveredFiles.manifestPath, reused: false, selectedEvidenceCount: plan.selectedEvidenceIds.length }
        })
      } catch (error) {
        observability.record(error instanceof Error && /validat|incompatible|missing/iu.test(error.message) ? "validationFailures" : "failures", 1, { format: command.format, outcome: "failure" })
        observability.event("resume_generation_failed", { errorClass: error instanceof Error ? error.name : "unknown", format: command.format })
        throw error
      } finally {
        observability.record("generationDuration", performance.now() - startedAt, { format: command.format, outcome })
      }
    }
  }
}
