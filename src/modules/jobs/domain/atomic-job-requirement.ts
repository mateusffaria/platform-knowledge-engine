import { createHash } from "node:crypto"

import {
  AtomicJobRequirement,
  CandidateRequirementComponentEvidence,
  CandidateRequirementEvidence,
  CoverageStatus,
  DiagnosticWarning,
  JobRequirement,
  RequirementComponentCoverage
} from "./model.js"

const componentIdentityVersion = "atomic-job-requirement-v1"

function deterministicUuid(value: string): string {
  const bytes = Buffer.from(createHash("sha256").update(value, "utf8").digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function atomicRequirementComponentId(input: {
  requirementId: string
  index: number
  originalText: string
  sourceTextStart: number
  sourceTextEnd: number
}): string {
  return deterministicUuid([
    componentIdentityVersion,
    input.requirementId,
    input.index,
    input.sourceTextStart,
    input.sourceTextEnd,
    input.originalText.normalize("NFKC").trim().toLocaleLowerCase("en")
  ].join("\u0000"))
}

export function singletonAtomicRequirement(requirement: Omit<JobRequirement, "components"> | JobRequirement): AtomicJobRequirement {
  const sourceTextStart = 0
  const sourceTextEnd = requirement.originalText.length
  return {
    id: atomicRequirementComponentId({
      requirementId: requirement.id,
      index: 0,
      originalText: requirement.originalText,
      sourceTextStart,
      sourceTextEnd
    }),
    jobRequirementId: requirement.id,
    componentIndex: 0,
    originalText: requirement.originalText,
    requirementType: requirement.requirementType,
    importance: requirement.importance,
    normalizedValue: requirement.normalizedValue,
    sourceExcerpt: requirement.sourceExcerpt,
    sourceLocation: { ...requirement.sourceLocation },
    sourceTextStart,
    sourceTextEnd
  }
}

export function atomicComponentsOf(requirement: JobRequirement): AtomicJobRequirement[] {
  if (!requirement.components || requirement.components.length === 0) {
    return [singletonAtomicRequirement(requirement)]
  }
  return [...requirement.components]
    .map((component) => ({ ...component, sourceLocation: { ...component.sourceLocation } }))
    .sort((left, right) => left.componentIndex - right.componentIndex || left.id.localeCompare(right.id))
}

export function candidateComponentsOf(requirement: CandidateRequirementEvidence): CandidateRequirementComponentEvidence[] {
  if (requirement.components && requirement.components.length > 0) {
    return [...requirement.components].sort((left, right) => left.componentIndex - right.componentIndex || left.componentId.localeCompare(right.componentId))
  }
  const componentId = atomicRequirementComponentId({
    requirementId: requirement.requirementId,
    index: 0,
    originalText: requirement.requirementText,
    sourceTextStart: 0,
    sourceTextEnd: requirement.requirementText.length
  })
  return [{
    requirementId: requirement.requirementId,
    componentId,
    componentIndex: 0,
    componentText: requirement.requirementText,
    requirementType: requirement.requirementType,
    importance: requirement.importance,
    candidates: requirement.candidates,
    reasonerCandidateIds: requirement.reasonerCandidateIds,
    diagnostics: requirement.diagnostics
  }]
}

export function validateAtomicComponents(requirement: JobRequirement): AtomicJobRequirement[] {
  const components = atomicComponentsOf(requirement)
  const identities = new Set<string>()
  for (const [index, component] of components.entries()) {
    if (component.jobRequirementId !== requirement.id) {
      throw new Error(`Atomic component ${component.id} does not belong to requirement ${requirement.id}.`)
    }
    if (component.componentIndex !== index) {
      throw new Error(`Atomic components for requirement ${requirement.id} are not contiguously ordered.`)
    }
    if (identities.has(component.id)) {
      throw new Error(`Atomic component identity ${component.id} is duplicated.`)
    }
    identities.add(component.id)
    if (component.sourceTextStart < 0 || component.sourceTextEnd <= component.sourceTextStart || component.sourceTextEnd > requirement.originalText.length) {
      throw new Error(`Atomic component ${component.id} has an invalid source span.`)
    }
    const sourceText = requirement.originalText.slice(component.sourceTextStart, component.sourceTextEnd)
    if (sourceText.trim().length === 0 || !sourceText.includes(component.originalText.trim())) {
      throw new Error(`Atomic component ${component.id} is not supported by its parent source span.`)
    }
    const expectedId = atomicRequirementComponentId({
      requirementId: requirement.id,
      index,
      originalText: component.originalText,
      sourceTextStart: component.sourceTextStart,
      sourceTextEnd: component.sourceTextEnd
    })
    if (component.id !== expectedId) {
      throw new Error(`Atomic component ${component.id} does not have the deterministic identity ${expectedId}.`)
    }
  }
  return components
}

export function aggregateParentCoverageStatus(componentCoverage: readonly Pick<RequirementComponentCoverage, "coverageStatus">[]): CoverageStatus {
  if (componentCoverage.length === 0) return "missing"
  const statuses = componentCoverage.map((component) => component.coverageStatus)
  if (statuses.every((status) => status === "missing")) return "missing"
  if (statuses.every((status) => status === "strong")) return "strong"
  if (statuses.every((status) => status === "weak")) return "weak"
  return "partial"
}

export function normalizeWarnings(
  warnings: readonly (string | DiagnosticWarning)[],
  legacyCode = "legacy_warning"
): DiagnosticWarning[] {
  const byKey = new Map<string, DiagnosticWarning>()
  for (const value of warnings) {
    const warning = typeof value === "string"
      ? { code: legacyCode, message: value.trim() }
      : { code: value.code.trim(), message: value.message.trim() }
    if (!warning.code || !warning.message) continue
    byKey.set(`${warning.code}\u0000${warning.message}`, warning)
  }
  return [...byKey.values()].sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message))
}
