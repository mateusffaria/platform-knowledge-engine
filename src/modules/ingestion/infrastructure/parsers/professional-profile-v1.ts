import { createHash, randomUUID } from "node:crypto"

import {
  Achievement,
  CanonicalCareerDocument,
  EvidenceClaim,
  EvidenceClaimCategory,
  EvidenceClaimPredicate,
  KnowledgeAsset,
  LegacyEvidenceClaimType,
  SourceReference,
  assertCanonicalCareerDocument
} from "../../../knowledge/domain/model.js"
import {
  ProfessionalProfileV1Candidate,
  ProfessionalProfileV1Metadata,
  ProfessionalProfileValidationError,
  ProfessionalProfileValidationIssue,
  professionalProfileCandidateLabels,
  professionalProfileLanguages,
  professionalProfileV1Schema
} from "../../../knowledge/domain/professional-profile.js"
import { ParsedMarkdownFrontmatter } from "./frontmatter.js"

interface HeadingBlock {
  title: string
  level: number
  line: number
  headingIndex: number
  startIndex: number
  endIndex: number
}

interface LocatedValue {
  value: string
  line: number
}

interface CanonicalProfileParse {
  metadata: ProfessionalProfileV1Metadata
  sections: HeadingBlock[]
  headings: HeadingBlock[]
  lines: string[]
}

const canonicalSectionTitles = [
  "Candidate",
  "Professional Summary",
  "Professional Experience",
  "Technical Skills",
  "Education",
  "Certifications"
] as const

const allowedCandidateLabels = new Set<string>(professionalProfileCandidateLabels)

function headingsIn(lines: string[], bodyStartLine: number): HeadingBlock[] {
  const headings = lines.flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/u.exec(line)
    return match ? [{ title: match[2], level: match[1].length, line: bodyStartLine + index, headingIndex: index, startIndex: index + 1, endIndex: lines.length }] : []
  })
  return headings.map((heading, index) => ({
    ...heading,
    endIndex: headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)?.headingIndex ?? lines.length
  }))
}

function scalarEntries(frontmatter: ParsedMarkdownFrontmatter, key: string) {
  return frontmatter.entries.filter((entry) => entry.key === key)
}

function candidateFields(section: HeadingBlock | undefined, lines: string[], bodyStartLine: number): Map<string, LocatedValue[]> {
  const fields = new Map<string, LocatedValue[]>()
  if (!section) return fields
  for (let index = section.startIndex; index < section.endIndex; index += 1) {
    if (/^#{1,6}\s+/u.test(lines[index])) continue
    const match = /^\s*[-*]\s+([^:]+):\s*(.*?)\s*$/u.exec(lines[index])
    if (!match || !allowedCandidateLabels.has(match[1].trim())) continue
    const label = match[1].trim()
    const values = fields.get(label) ?? []
    values.push({ value: match[2].trim(), line: bodyStartLine + index })
    fields.set(label, values)
  }
  return fields
}

function firstValue(fields: Map<string, LocatedValue[]>, label: string): string | undefined {
  const value = fields.get(label)?.[0]?.value.trim()
  return value ? value : undefined
}

function buildCandidate(fields: Map<string, LocatedValue[]>): ProfessionalProfileV1Candidate {
  return {
    name: firstValue(fields, "Name")!,
    ...(firstValue(fields, "Headline") ? { headline: firstValue(fields, "Headline") } : {}),
    ...(firstValue(fields, "Location") ? { location: firstValue(fields, "Location") } : {}),
    ...(firstValue(fields, "Email") ? { email: firstValue(fields, "Email") } : {}),
    ...(firstValue(fields, "Phone") ? { phone: firstValue(fields, "Phone") } : {}),
    ...(firstValue(fields, "LinkedIn") ? { linkedin: firstValue(fields, "LinkedIn") } : {}),
    ...(firstValue(fields, "GitHub") ? { github: firstValue(fields, "GitHub") } : {}),
    ...(firstValue(fields, "Website") ? { website: firstValue(fields, "Website") } : {})
  }
}

export function validateProfessionalProfileV1(frontmatter: ParsedMarkdownFrontmatter): CanonicalProfileParse {
  const issues: ProfessionalProfileValidationIssue[] = []
  if (!frontmatter.present) issues.push({ code: "missing_frontmatter", path: "frontmatter", message: "professional-profile/v1 requires YAML front matter." })
  if (frontmatter.present && !frontmatter.closed) issues.push({ code: "unclosed_frontmatter", path: "frontmatter", message: "The YAML front matter must end with --- on its own line." })

  const schemaEntries = scalarEntries(frontmatter, "schema")
  if (schemaEntries.length === 0) issues.push({ code: "missing_schema", path: "frontmatter.schema", message: `Set schema: ${professionalProfileV1Schema}.` })
  if (schemaEntries.length > 1) issues.push({ code: "duplicate_schema", path: "frontmatter.schema", line: schemaEntries[1]?.line, message: "The schema front-matter key must appear exactly once." })
  const schemaEntry = schemaEntries[0]
  if (schemaEntry?.kind === "sequence") issues.push({ code: "invalid_schema_type", path: "frontmatter.schema", line: schemaEntry.line, message: "The schema value must be a scalar string." })
  if (schemaEntry?.kind === "scalar" && schemaEntry.value !== professionalProfileV1Schema) issues.push({ code: "unsupported_schema", path: "frontmatter.schema", value: String(schemaEntry.value), line: schemaEntry.line, message: `Unsupported professional profile schema ${schemaEntry.value || "(empty)"}; expected ${professionalProfileV1Schema}.` })

  const languageEntries = scalarEntries(frontmatter, "language")
  if (languageEntries.length === 0) issues.push({ code: "missing_language", path: "frontmatter.language", message: "Set language to en or pt-BR." })
  if (languageEntries.length > 1) issues.push({ code: "duplicate_language", path: "frontmatter.language", line: languageEntries[1]?.line, message: "The language front-matter key must appear exactly once." })
  const languageEntry = languageEntries[0]
  if (languageEntry?.kind === "sequence") issues.push({ code: "invalid_language_type", path: "frontmatter.language", line: languageEntry.line, message: "The language value must be a scalar string." })
  if (languageEntry?.kind === "scalar" && !professionalProfileLanguages.includes(languageEntry.value as typeof professionalProfileLanguages[number])) issues.push({ code: "unsupported_language", path: "frontmatter.language", value: String(languageEntry.value), line: languageEntry.line, message: `Unsupported language ${languageEntry.value || "(empty)"}; expected en or pt-BR.` })

  const lines = frontmatter.body.split(/\r?\n/u)
  const headings = headingsIn(lines, frontmatter.bodyStartLine)
  const sections = headings.filter((heading) => heading.level === 1)
  for (const title of canonicalSectionTitles) {
    const matches = sections.filter((section) => section.title === title)
    if (title === "Candidate" && matches.length === 0) issues.push({ code: "missing_candidate_section", path: "sections.Candidate", message: "Add a top-level # Candidate section." })
    if (matches.length > 1) issues.push({ code: "duplicate_section", path: `sections.${title}`, line: matches[1].line, message: `The ${title} section must appear at most once.` })
  }

  const candidateSection = sections.find((section) => section.title === "Candidate")
  const fields = candidateFields(candidateSection, lines, frontmatter.bodyStartLine)
  for (const [label, values] of fields) {
    if (values.length > 1) issues.push({ code: "duplicate_candidate_field", path: `candidate.${label}`, line: values[1].line, message: `Candidate field ${label} must appear at most once.` })
  }
  const name = firstValue(fields, "Name")
  if (!name) issues.push({ code: "missing_candidate_name", path: "candidate.Name", line: candidateSection?.line, message: "Add a non-empty - Name: value in the Candidate section; names are never inferred." })

  if (issues.length > 0) throw new ProfessionalProfileValidationError(issues)
  return {
    metadata: {
      schema: professionalProfileV1Schema,
      language: languageEntry!.value as typeof professionalProfileLanguages[number],
      candidate: buildCandidate(fields)
    },
    sections,
    headings,
    lines
  }
}

function nestedBlocks(parent: HeadingBlock, headings: HeadingBlock[], level: number): HeadingBlock[] {
  return headings.filter((heading) => heading.level === level && heading.headingIndex > parent.headingIndex && heading.headingIndex < parent.endIndex)
}

function directFieldValues(block: HeadingBlock, headings: HeadingBlock[], lines: string[], bodyStartLine: number): Map<string, LocatedValue> {
  const firstNested = headings.find((heading) => heading.headingIndex > block.headingIndex && heading.headingIndex < block.endIndex && heading.level > block.level)
  const end = firstNested?.headingIndex ?? block.endIndex
  const values = new Map<string, LocatedValue>()
  for (let index = block.startIndex; index < end; index += 1) {
    const match = /^\s*[-*]\s+([^:]+):\s*(.*?)\s*$/u.exec(lines[index])
    if (match && match[2].trim()) values.set(match[1].trim(), { value: match[2].trim(), line: bodyStartLine + index })
  }
  return values
}

function bulletValues(block: HeadingBlock, lines: string[], bodyStartLine: number): LocatedValue[] {
  const values: LocatedValue[] = []
  for (let index = block.startIndex; index < block.endIndex; index += 1) {
    if (/^#{1,6}\s+/u.test(lines[index])) continue
    const match = /^\s*[-*]\s+(.+?)\s*$/u.exec(lines[index])
    if (match) values.push({ value: match[1].trim(), line: bodyStartLine + index })
  }
  return values
}

function sectionText(section: HeadingBlock | undefined, lines: string[]): string | undefined {
  if (!section) return undefined
  const text = lines.slice(section.startIndex, section.endIndex).filter((line) => !/^#{1,6}\s+/u.test(line)).join("\n").trim()
  return text || undefined
}

function sourceReliability(metadata: Record<string, string | string[]>): number {
  const value = metadata.sourceReliability ?? metadata.source_reliability ?? metadata.reliability
  if (Array.isArray(value)) return 50
  const parsed = Number.parseInt(value ?? "50", 10)
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50
}

export function parseProfessionalProfileV1(filePath: string, rawContent: string, frontmatter: ParsedMarkdownFrontmatter): CanonicalCareerDocument {
  const parsed = validateProfessionalProfileV1(frontmatter)
  const now = new Date()
  const sourceDocumentId = randomUUID()
  const profileAssetId = randomUUID()
  const summarySection = parsed.sections.find((section) => section.title === "Professional Summary")
  const summary = sectionText(summarySection, parsed.lines)
  const source = {
    id: sourceDocumentId,
    sourceType: "markdown" as const,
    path: filePath,
    contentHash: createHash("sha256").update(rawContent, "utf8").digest("hex"),
    sourceReliability: sourceReliability(frontmatter.metadata),
    metadata: { ...frontmatter.metadata, professionalProfile: parsed.metadata },
    rawContent,
    ingestedAt: now
  }
  const asset: KnowledgeAsset = { id: profileAssetId, sourceDocumentId, assetType: "professional_profile", title: parsed.metadata.candidate.name, summary, createdAt: now }
  const assets: KnowledgeAsset[] = [asset]
  const references: SourceReference[] = []
  const evidenceClaims: EvidenceClaim[] = []
  const skills: CanonicalCareerDocument["skills"] = []
  const experiences: CanonicalCareerDocument["experiences"] = []
  const achievements: Achievement[] = []

  function createAsset(assetType: KnowledgeAsset["assetType"], title: string, assetSummary?: string): KnowledgeAsset {
    const created = { id: randomUUID(), sourceDocumentId, assetType, title, ...(assetSummary ? { summary: assetSummary } : {}), createdAt: now }
    assets.push(created)
    return created
  }

  function createEvidence(input: {
    subjectAssetId: string
    claimType: LegacyEvidenceClaimType
    claimCategory: EvidenceClaimCategory
    predicate: EvidenceClaimPredicate
    claimText: string
    excerpt: string
    section: string
    line: number
    relatedAssetId?: string
    valueText?: string
  }): { reference: SourceReference; claim: EvidenceClaim } {
    const reference: SourceReference = {
      id: randomUUID(),
      sourceDocumentId,
      section: input.section,
      locator: `line:${input.line}`,
      excerpt: input.excerpt,
      sourceLanguage: parsed.metadata.language,
      originalSectionLabel: input.section.split(" > ")[0]
    }
    const claim: EvidenceClaim = {
      id: randomUUID(),
      subjectAssetId: input.subjectAssetId,
      knowledgeAssetId: input.subjectAssetId,
      sourceReferenceId: reference.id,
      claimType: input.claimType,
      claimCategory: input.claimCategory,
      predicate: input.predicate,
      claimText: input.claimText,
      ...(input.relatedAssetId ? { relatedAssetId: input.relatedAssetId } : {}),
      ...(input.valueText ? { valueText: input.valueText } : {}),
      sourceLanguage: parsed.metadata.language,
      originalSectionLabel: reference.originalSectionLabel,
      status: "single_source",
      confidenceScore: source.sourceReliability,
      conflictSeverity: "none"
    }
    references.push(reference)
    evidenceClaims.push(claim)
    return { reference, claim }
  }

  if (summary && summarySection) createEvidence({ subjectAssetId: asset.id, claimType: "experience", claimCategory: "fact", predicate: "demonstrates", claimText: summary, excerpt: summary, section: summarySection.title, line: summarySection.line })

  const experienceSection = parsed.sections.find((section) => section.title === "Professional Experience")
  if (experienceSection) {
    for (const entry of nestedBlocks(experienceSection, parsed.headings, 2)) {
      const fields = directFieldValues(entry, parsed.headings, parsed.lines, frontmatter.bodyStartLine)
      const role = fields.get("Role")?.value
      if (!role) continue
      const organization = entry.title.trim()
      const startDate = fields.get("Start Date")?.value
      const endDate = fields.get("End Date")?.value
      const context = fields.get("Context")?.value ?? fields.get("Project")?.value
      const experienceTitle = `${role} at ${organization}`
      const experienceAsset = createAsset("professional_experience", experienceTitle, context)
      const organizationAsset = createAsset("organization", organization)
      const roleAsset = createAsset("role", role)
      const claimIds: string[] = []
      const referenceIds: string[] = []
      const worksAt = createEvidence({ subjectAssetId: experienceAsset.id, claimType: "experience", claimCategory: "relationship", predicate: "works_at", claimText: `${experienceTitle} works at ${organization}`, excerpt: organization, section: `${experienceSection.title} > ${organization}`, line: entry.line, relatedAssetId: organizationAsset.id })
      claimIds.push(worksAt.claim.id); referenceIds.push(worksAt.reference.id)
      const roleEvidence = createEvidence({ subjectAssetId: experienceAsset.id, claimType: "experience", claimCategory: "fact", predicate: "holds_role", claimText: `${experienceTitle} holds role ${role}`, excerpt: `Role: ${role}`, section: `${experienceSection.title} > ${organization}`, line: fields.get("Role")?.line ?? entry.line, relatedAssetId: roleAsset.id })
      claimIds.push(roleEvidence.claim.id); referenceIds.push(roleEvidence.reference.id)
      if (startDate || endDate) {
        const period = [startDate, endDate].filter(Boolean).join(" - ")
        const periodEvidence = createEvidence({ subjectAssetId: experienceAsset.id, claimType: "experience", claimCategory: "fact", predicate: "occurred_during", claimText: `${experienceTitle} occurred during ${period}`, excerpt: period, section: `${experienceSection.title} > ${organization}`, line: fields.get("Start Date")?.line ?? fields.get("End Date")?.line ?? entry.line, valueText: period })
        claimIds.push(periodEvidence.claim.id); referenceIds.push(periodEvidence.reference.id)
      }
      const achievementBlock = nestedBlocks(entry, parsed.headings, 3).find((block) => block.title === "Achievements")
      for (const achievement of achievementBlock ? bulletValues(achievementBlock, parsed.lines, frontmatter.bodyStartLine) : []) {
        const evidence = createEvidence({ subjectAssetId: experienceAsset.id, claimType: "achievement", claimCategory: "achievement", predicate: "demonstrates", claimText: achievement.value, excerpt: achievement.value, section: `${experienceSection.title} > ${organization} > Achievements`, line: achievement.line })
        claimIds.push(evidence.claim.id); referenceIds.push(evidence.reference.id)
        achievements.push({ id: randomUUID(), knowledgeAssetId: experienceAsset.id, title: achievement.value, evidenceClaimIds: [evidence.claim.id], sourceReferenceIds: [evidence.reference.id] })
      }
      const technologyBlock = nestedBlocks(entry, parsed.headings, 3).find((block) => block.title === "Technologies")
      for (const technology of technologyBlock ? bulletValues(technologyBlock, parsed.lines, frontmatter.bodyStartLine) : []) {
        const skillAsset = createAsset("skill", technology.value, "Technology")
        const evidence = createEvidence({ subjectAssetId: experienceAsset.id, claimType: "skill", claimCategory: "relationship", predicate: "uses_technology", claimText: `${experienceTitle} uses ${technology.value}`, excerpt: technology.value, section: `${experienceSection.title} > ${organization} > Technologies`, line: technology.line, relatedAssetId: skillAsset.id })
        skills.push({ id: randomUUID(), knowledgeAssetId: skillAsset.id, name: technology.value, category: "Technology", evidenceClaimIds: [evidence.claim.id], sourceReferenceIds: [evidence.reference.id] })
      }
      experiences.push({ id: randomUUID(), knowledgeAssetId: experienceAsset.id, role, organization, ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(context ? { description: context } : {}), evidenceClaimIds: claimIds, sourceReferenceIds: referenceIds })
    }
  }

  const skillSection = parsed.sections.find((section) => section.title === "Technical Skills")
  if (skillSection) {
    for (const group of nestedBlocks(skillSection, parsed.headings, 2)) {
      for (const item of bulletValues(group, parsed.lines, frontmatter.bodyStartLine)) {
        const skillAsset = createAsset("skill", item.value, group.title)
        const evidence = createEvidence({ subjectAssetId: asset.id, claimType: "skill", claimCategory: "capability", predicate: "demonstrates", claimText: `Demonstrates ${item.value}`, excerpt: item.value, section: `${skillSection.title} > ${group.title}`, line: item.line, relatedAssetId: skillAsset.id })
        skills.push({ id: randomUUID(), knowledgeAssetId: skillAsset.id, name: item.value, category: group.title, evidenceClaimIds: [evidence.claim.id], sourceReferenceIds: [evidence.reference.id] })
      }
    }
  }

  for (const definition of [{ section: "Education", assetType: "education", category: "fact" }, { section: "Certifications", assetType: "certification", category: "capability" }] as const) {
    const section = parsed.sections.find((candidate) => candidate.title === definition.section)
    if (!section) continue
    for (const entry of nestedBlocks(section, parsed.headings, 2)) {
      const fields = directFieldValues(entry, parsed.headings, parsed.lines, frontmatter.bodyStartLine)
      const details = [...fields].map(([label, item]) => `${label}: ${item.value}`).join("; ") || undefined
      const createdAsset = createAsset(definition.assetType, entry.title, details)
      createEvidence({ subjectAssetId: createdAsset.id, claimType: "achievement", claimCategory: definition.category, predicate: "demonstrates", claimText: details ? `${entry.title}: ${details}` : entry.title, excerpt: details ?? entry.title, section: `${section.title} > ${entry.title}`, line: entry.line })
    }
  }

  const document: CanonicalCareerDocument = { source, asset, assets, references, evidenceClaims, skills, experiences, projects: [], achievements }
  assertCanonicalCareerDocument(document)
  return document
}
