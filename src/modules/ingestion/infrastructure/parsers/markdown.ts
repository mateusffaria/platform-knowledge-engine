import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CanonicalCareerDocument,
  EvidenceClaimCategory,
  EvidenceClaimPredicate,
  EvidenceClaim,
  KnowledgeAsset,
  LegacyEvidenceClaimType,
  SourceReference,
  assertCanonicalCareerDocument
} from "../../../knowledge/domain/model.js";
import { CareerDocumentSourceParser } from "../../application/ports/career-document-source-parser.js";
import { claimsProfessionalProfileSchema, parseMarkdownFrontmatter } from "./frontmatter.js";
import { parseProfessionalProfileV1 } from "./professional-profile-v1.js";

export interface MarkdownIngestionResult {
  document: CanonicalCareerDocument;
}

interface MarkdownSection {
  title: string;
  normalizedTitle: string;
  startLine: number;
  lines: string[];
}

interface EvidenceBundle {
  sourceReference: SourceReference;
  evidenceClaim: EvidenceClaim;
}

const supportedMarkdownExtensions = new Set([".md", ".markdown"]);

export async function readMarkdownSource(filePath: string): Promise<{
  path: string;
  rawContent: string;
}> {
  validateMarkdownPath(filePath);

  try {
    return {
      path: filePath,
      rawContent: await readFile(filePath, "utf8")
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Source file not found: ${filePath}`);
    }

    throw error;
  }
}

export function validateMarkdownPath(filePath: string): void {
  const extension = path.extname(filePath).toLowerCase();
  if (!supportedMarkdownExtensions.has(extension)) {
    throw new Error("Only Markdown ingestion is supported. Normalize PDF or DOCX resumes into a professional-profile/v1 .md or .markdown file first.");
  }
}

export async function ingestMarkdownFile(filePath: string): Promise<MarkdownIngestionResult> {
  const source = await readMarkdownSource(filePath);

  return {
    document: parseMarkdownCareerDocument(source.path, source.rawContent)
  };
}

export class MarkdownCareerDocumentParser implements CareerDocumentSourceParser {
  async parse(filePath: string): Promise<MarkdownIngestionResult> {
    return ingestMarkdownFile(filePath);
  }
}

export function parseMarkdownCareerDocument(filePath: string, rawContent: string): CanonicalCareerDocument {
  const frontmatter = parseMarkdownFrontmatter(rawContent);
  if (claimsProfessionalProfileSchema(frontmatter)) {
    return parseProfessionalProfileV1(filePath, rawContent, frontmatter);
  }
  const { metadata, body } = frontmatter;
  const sections = splitSections(body);
  const now = new Date();
  const sourceDocumentId = randomUUID();
  const knowledgeAssetId = randomUUID();
  const title = metadata.title ?? findTitle(body) ?? path.basename(filePath);
  const summary = sectionText(sections, "summary") ?? sectionText(sections, "profile");
  const sourceLanguage = metadataLanguage(metadata);

  const source = {
    id: sourceDocumentId,
    sourceType: "markdown" as const,
    path: filePath,
    contentHash: contentHash(rawContent),
    sourceReliability: sourceReliability(metadata),
    metadata,
    rawContent,
    ingestedAt: now
  };

  const asset = {
    id: knowledgeAssetId,
    sourceDocumentId,
    assetType: "professional_profile" as const,
    title: String(title),
    summary,
    createdAt: now
  };

  const assets: KnowledgeAsset[] = [asset];
  const references: SourceReference[] = [];
  const evidenceClaims: EvidenceClaim[] = [];

  function createAsset(assetType: KnowledgeAsset["assetType"], assetTitle: string, assetSummary?: string): KnowledgeAsset {
    const knowledgeAsset: KnowledgeAsset = {
      id: randomUUID(),
      sourceDocumentId,
      assetType,
      title: assetTitle,
      summary: assetSummary,
      createdAt: now
    };
    assets.push(knowledgeAsset);

    return knowledgeAsset;
  }

  function evidenceFor(
    input: {
      subjectAssetId: string;
      claimType: LegacyEvidenceClaimType;
      claimCategory: EvidenceClaimCategory;
      predicate: EvidenceClaimPredicate;
      relatedAssetId?: string;
      valueText?: string;
      valueUnit?: string;
    },
    section: MarkdownSection,
    claimText: string,
    excerpt: string
  ): EvidenceBundle {
    const sourceReference: SourceReference = {
      id: randomUUID(),
      sourceDocumentId,
      section: section.title,
      locator: `line:${section.startLine}`,
      excerpt,
      sourceLanguage,
      originalSectionLabel: section.title
    };
    const evidenceClaim: EvidenceClaim = {
      id: randomUUID(),
      subjectAssetId: input.subjectAssetId,
      knowledgeAssetId: input.subjectAssetId,
      sourceReferenceId: sourceReference.id,
      claimType: input.claimType,
      claimCategory: input.claimCategory,
      predicate: input.predicate,
      claimText,
      relatedAssetId: input.relatedAssetId,
      valueText: input.valueText,
      valueUnit: input.valueUnit,
      sourceLanguage,
      originalSectionLabel: section.title,
      status: "single_source",
      confidenceScore: source.sourceReliability,
      conflictSeverity: "none"
    };

    references.push(sourceReference);
    evidenceClaims.push(evidenceClaim);

    return { sourceReference, evidenceClaim };
  }

  const skills = collectSectionItems(sections, "skills", "habilidades", "competencias").map((item) => {
    const skillAsset = createAsset("skill", item.text, item.subsection);
    const { sourceReference, evidenceClaim } = evidenceFor({
      subjectAssetId: asset.id,
      claimType: "skill",
      claimCategory: "capability",
      predicate: "demonstrates",
      relatedAssetId: skillAsset.id
    }, item.section, `Demonstrates ${item.text}`, item.text);

    return {
      id: randomUUID(),
      knowledgeAssetId: skillAsset.id,
      name: item.text,
      category: item.subsection,
      evidenceClaimIds: [evidenceClaim.id],
      sourceReferenceIds: [sourceReference.id]
    };
  });

  const experiences = collectSectionItems(
    sections,
    "experience",
    "experiences",
    "work experience",
    "experiencia",
    "experiencias"
  ).map((item) => {
    const parsed = parseExperience(item.text);
    const experienceTitle = parsed.organization
      ? `${parsed.role} at ${parsed.organization}`
      : parsed.role;
    const experienceAsset = createAsset("professional_experience", experienceTitle, parsed.description);
    const relatedClaimIds: string[] = [];
    const relatedReferenceIds: string[] = [];

    if (parsed.organization) {
      const organizationAsset = createAsset("organization", parsed.organization);
      const { sourceReference, evidenceClaim } = evidenceFor({
        subjectAssetId: experienceAsset.id,
        claimType: "experience",
        claimCategory: "relationship",
        predicate: "works_at",
        relatedAssetId: organizationAsset.id
      }, item.section, `${experienceTitle} works at ${parsed.organization}`, item.text);
      relatedClaimIds.push(evidenceClaim.id);
      relatedReferenceIds.push(sourceReference.id);
    }

    const roleAsset = createAsset("role", parsed.role);
    const { sourceReference: roleReference, evidenceClaim: roleClaim } = evidenceFor({
      subjectAssetId: experienceAsset.id,
      claimType: "experience",
      claimCategory: "fact",
      predicate: "holds_role",
      relatedAssetId: roleAsset.id
    }, item.section, `${experienceTitle} holds role ${parsed.role}`, item.text);
    relatedClaimIds.push(roleClaim.id);
    relatedReferenceIds.push(roleReference.id);

    if (parsed.startDate || parsed.endDate) {
      const occurredDuring = [parsed.startDate, parsed.endDate].filter(Boolean).join(" - ");
      const { sourceReference, evidenceClaim } = evidenceFor({
        subjectAssetId: experienceAsset.id,
        claimType: "experience",
        claimCategory: "fact",
        predicate: "occurred_during",
        valueText: occurredDuring
      }, item.section, `${experienceTitle} occurred during ${occurredDuring}`, item.text);
      relatedClaimIds.push(evidenceClaim.id);
      relatedReferenceIds.push(sourceReference.id);
    }

    if (parsed.description) {
      const { sourceReference, evidenceClaim } = evidenceFor({
        subjectAssetId: experienceAsset.id,
        claimType: "experience",
        claimCategory: "responsibility",
        predicate: "participated_in"
      }, item.section, parsed.description, item.text);
      relatedClaimIds.push(evidenceClaim.id);
      relatedReferenceIds.push(sourceReference.id);
    }

    return {
      id: randomUUID(),
      knowledgeAssetId: experienceAsset.id,
      role: parsed.role,
      organization: parsed.organization,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      description: parsed.description,
      evidenceClaimIds: relatedClaimIds,
      sourceReferenceIds: relatedReferenceIds
    };
  });

  const projects = collectSectionItems(sections, "projects").map((item) => {
    const parsed = parseNamedDescription(item.text);
    const projectAsset = createAsset("project", parsed.name, parsed.description);
    const technologies = extractTechnologies(parsed.description ?? "");
    const { sourceReference, evidenceClaim } = evidenceFor({
      subjectAssetId: projectAsset.id,
      claimType: "project",
      claimCategory: "achievement",
      predicate: "participated_in"
    }, item.section, item.text, item.text);
    const evidenceClaimIds = [evidenceClaim.id];
    const sourceReferenceIds = [sourceReference.id];

    for (const technology of technologies) {
      const skillAsset = createAsset("skill", technology, "Technology");
      const { sourceReference: technologyReference, evidenceClaim: technologyClaim } = evidenceFor({
        subjectAssetId: projectAsset.id,
        claimType: "project",
        claimCategory: "relationship",
        predicate: "uses_technology",
        relatedAssetId: skillAsset.id
      }, item.section, `${parsed.name} uses ${technology}`, item.text);
      evidenceClaimIds.push(technologyClaim.id);
      sourceReferenceIds.push(technologyReference.id);
    }

    return {
      id: randomUUID(),
      knowledgeAssetId: projectAsset.id,
      name: parsed.name,
      description: parsed.description,
      technologies,
      evidenceClaimIds,
      sourceReferenceIds
    };
  });

  const achievements = collectSectionItems(sections, "achievements").map((item) => {
    const parsed = parseNamedDescription(item.text);
    const metric = metricFromText(item.text);
    const { sourceReference, evidenceClaim } = evidenceFor({
      subjectAssetId: asset.id,
      claimType: "achievement",
      claimCategory: metric ? "metric" : "achievement",
      predicate: metric?.predicate ?? "demonstrates",
      valueText: metric?.valueText,
      valueUnit: metric?.valueUnit
    }, item.section, item.text, item.text);

    return {
      id: randomUUID(),
      knowledgeAssetId: asset.id,
      title: parsed.name,
      description: parsed.description,
      evidenceClaimIds: [evidenceClaim.id],
      sourceReferenceIds: [sourceReference.id]
    };
  });

  for (const item of collectSectionItems(sections, "education", "educacao", "formacao")) {
    const parsed = parseNamedDescription(item.text);
    const educationAsset = createAsset("education", parsed.name, parsed.description);
    evidenceFor({
      subjectAssetId: educationAsset.id,
      claimType: "achievement",
      claimCategory: "fact",
      predicate: "demonstrates"
    }, item.section, item.text, item.text);
  }

  for (const item of collectSectionItems(sections, "certifications", "certification", "certificacoes", "certificacao")) {
    const parsed = parseNamedDescription(item.text);
    const certificationAsset = createAsset("certification", parsed.name, parsed.description);
    evidenceFor({
      subjectAssetId: certificationAsset.id,
      claimType: "achievement",
      claimCategory: "capability",
      predicate: "demonstrates"
    }, item.section, item.text, item.text);
  }

  const document: CanonicalCareerDocument = {
    source,
    asset,
    assets,
    references,
    evidenceClaims,
    skills,
    experiences,
    projects,
    achievements
  };

  assertCanonicalCareerDocument(document);

  return document;
}

export function contentHash(rawContent: string): string {
  return createHash("sha256").update(rawContent, "utf8").digest("hex");
}

function sourceReliability(metadata: Record<string, string | string[]>): number {
  const value = metadata.sourceReliability ?? metadata.source_reliability ?? metadata.reliability;
  if (Array.isArray(value)) {
    return 50;
  }

  const parsed = Number.parseInt(value ?? "50", 10);
  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(100, Math.max(0, parsed));
}

function metadataLanguage(metadata: Record<string, string | string[]>): string | undefined {
  const value = metadata.language ?? metadata.sourceLanguage ?? metadata.source_language ?? metadata.lang;
  return Array.isArray(value) ? undefined : value;
}

function splitSections(body: string): MarkdownSection[] {
  const lines = body.split(/\r?\n/);
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | undefined;

  lines.forEach((line, index) => {
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = {
        title: heading[2],
        normalizedTitle: normalizeHeading(heading[2]),
        startLine: index + 1,
        lines: []
      };
      sections.push(current);
      return;
    }

    current?.lines.push(line);
  });

  return sections;
}

function collectSectionItems(
  sections: MarkdownSection[],
  ...acceptedTitles: string[]
): Array<{ section: MarkdownSection; subsection?: string; text: string }> {
  const accepted = new Set(acceptedTitles.map(normalizeHeading));
  return sections
    .filter((section) => accepted.has(section.normalizedTitle))
    .flatMap((section) => {
      let subsection: string | undefined;

      return section.lines.flatMap((line) => {
        const subheading = /^###\s+(.+?)\s*$/.exec(line);
        if (subheading) {
          subsection = subheading[1];
          return [];
        }

        const item = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
        if (!item) {
          return [];
        }

        return [{ section, subsection, text: item[1] }];
      });
    });
}

function sectionText(sections: MarkdownSection[], title: string): string | undefined {
  return sections
    .find((section) => section.normalizedTitle === normalizeHeading(title))
    ?.lines.join("\n")
    .trim();
}

function findTitle(body: string): string | undefined {
  return /^#\s+(.+?)\s*$/m.exec(body)?.[1];
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseExperience(text: string): {
  role: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
} {
  const [head, description] = splitOnce(text, ":");
  const dateMatch = /\(([^)]+)\)\s*$/.exec(head);
  const withoutDate = dateMatch ? head.slice(0, dateMatch.index).trim() : head.trim();
  const [role, organization] = splitOnce(withoutDate, " at ");
  const [startDate, endDate] = dateMatch ? splitOnce(dateMatch[1], "-") : [undefined, undefined];

  return {
    role: role.trim(),
    organization: organization?.trim(),
    startDate: startDate?.trim(),
    endDate: endDate?.trim(),
    description: description?.trim()
  };
}

function parseNamedDescription(text: string): { name: string; description?: string } {
  const [name, description] = splitOnce(text, ":");

  return {
    name: name.trim(),
    description: description?.trim()
  };
}

function extractTechnologies(description: string): string[] {
  const match = /technologies?\s*:\s*(.+)$/i.exec(description);
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((technology) => technology.trim().replace(/[.;]$/, ""))
    .filter(Boolean);
}

function metricFromText(text: string): {
  predicate: EvidenceClaimPredicate;
  valueText: string;
  valueUnit?: string;
} | undefined {
  const lower = text.toLowerCase();
  const percentage = /\b(\d+(?:\.\d+)?)\s*%/.exec(text);
  const money = /(?:\$|usd\s*)(\d+(?:[\.,]\d+)?[kKmM]?)/.exec(text);
  const valueText = percentage?.[0] ?? money?.[0];
  if (!valueText) {
    return undefined;
  }

  if (lower.includes("cost") || lower.includes("spend")) {
    return { predicate: "reduced_cost", valueText, valueUnit: money ? "currency" : "percent" };
  }

  if (lower.includes("processing time") || lower.includes("latency") || lower.includes("time")) {
    return { predicate: "reduced_processing_time", valueText, valueUnit: percentage ? "percent" : undefined };
  }

  if (lower.includes("reliability") || lower.includes("uptime")) {
    return { predicate: "improved_reliability", valueText, valueUnit: percentage ? "percent" : undefined };
  }

  return undefined;
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index === -1) {
    return [value, undefined];
  }

  return [value.slice(0, index), value.slice(index + separator.length)];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
