import { createHash } from "node:crypto"

import { CandidateResumeMetadata, ResumeFormat, resumeRendererVersion, ResumeTemplateId } from "../domain/resume-document.js"
import { ResumeContentPlan, ResumeLanguage, ResumeLength } from "../domain/model.js"

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalValue(child)]))
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

export function buildResumeRenderingIdentity(input: {
  plan: ResumeContentPlan
  candidate: CandidateResumeMetadata
  format: ResumeFormat
  language: ResumeLanguage
  length: ResumeLength
  templateId: ResumeTemplateId
  templateVersion: string
  rendererVersion?: string
}): string {
  return sha256(canonicalJson({
    planId: input.plan.id,
    planIdentity: input.plan.planIdentity,
    planSchemaVersion: input.plan.schemaVersion,
    candidate: input.candidate,
    format: input.format,
    language: input.language,
    length: input.length,
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    rendererVersion: input.rendererVersion ?? resumeRendererVersion
  }))
}

export function buildResumeGenerationIdentity(renderingIdentity: string, regenerationId?: string): string {
  return sha256(canonicalJson({ renderingIdentity, ...(regenerationId ? { regenerationId } : {}) }))
}

export const resumeFormatMetadata: Readonly<Record<ResumeFormat, { extension: string; mediaType: string }>> = Object.freeze({
  markdown: Object.freeze({ extension: ".md", mediaType: "text/markdown; charset=utf-8" }),
  html: Object.freeze({ extension: ".html", mediaType: "text/html; charset=utf-8" }),
  pdf: Object.freeze({ extension: ".pdf", mediaType: "application/pdf" })
})
