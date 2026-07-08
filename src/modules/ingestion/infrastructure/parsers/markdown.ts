import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CanonicalCareerDocument,
  EvidenceClaim,
  SourceReference,
  assertCanonicalCareerDocument
} from "../../../knowledge/domain/model.js";
import { CareerDocumentSourceParser } from "../../application/ports/career-document-source-parser.js";

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
    throw new Error("Only Markdown ingestion is supported. Use a .md or .markdown file.");
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
  const { metadata, body } = parseFrontmatter(rawContent);
  const sections = splitSections(body);
  const now = new Date();
  const sourceDocumentId = randomUUID();
  const knowledgeAssetId = randomUUID();
  const title = metadata.title ?? findTitle(body) ?? path.basename(filePath);
  const summary = sectionText(sections, "summary") ?? sectionText(sections, "profile");

  const source = {
    id: sourceDocumentId,
    sourceType: "markdown" as const,
    path: filePath,
    contentHash: contentHash(rawContent),
    metadata,
    rawContent,
    ingestedAt: now
  };

  const asset = {
    id: knowledgeAssetId,
    sourceDocumentId,
    assetType: "canonical-career-document" as const,
    title: String(title),
    summary,
    createdAt: now
  };

  const references: SourceReference[] = [];
  const evidenceClaims: EvidenceClaim[] = [];

  function evidenceFor(
    claimType: EvidenceClaim["claimType"],
    section: MarkdownSection,
    claimText: string,
    excerpt: string
  ): EvidenceBundle {
    const sourceReference: SourceReference = {
      id: randomUUID(),
      sourceDocumentId,
      section: section.title,
      locator: `line:${section.startLine}`,
      excerpt
    };
    const evidenceClaim: EvidenceClaim = {
      id: randomUUID(),
      knowledgeAssetId,
      sourceReferenceId: sourceReference.id,
      claimType,
      claimText
    };

    references.push(sourceReference);
    evidenceClaims.push(evidenceClaim);

    return { sourceReference, evidenceClaim };
  }

  const skills = collectSectionItems(sections, "skills").map((item) => {
    const { sourceReference, evidenceClaim } = evidenceFor("skill", item.section, item.text, item.text);

    return {
      id: randomUUID(),
      knowledgeAssetId,
      name: item.text,
      category: item.subsection,
      evidenceClaimIds: [evidenceClaim.id],
      sourceReferenceIds: [sourceReference.id]
    };
  });

  const experiences = collectSectionItems(sections, "experience", "experiences", "work experience").map((item) => {
    const parsed = parseExperience(item.text);
    const { sourceReference, evidenceClaim } = evidenceFor("experience", item.section, item.text, item.text);

    return {
      id: randomUUID(),
      knowledgeAssetId,
      role: parsed.role,
      organization: parsed.organization,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      description: parsed.description,
      evidenceClaimIds: [evidenceClaim.id],
      sourceReferenceIds: [sourceReference.id]
    };
  });

  const projects = collectSectionItems(sections, "projects").map((item) => {
    const parsed = parseNamedDescription(item.text);
    const { sourceReference, evidenceClaim } = evidenceFor("project", item.section, item.text, item.text);

    return {
      id: randomUUID(),
      knowledgeAssetId,
      name: parsed.name,
      description: parsed.description,
      technologies: extractTechnologies(parsed.description ?? ""),
      evidenceClaimIds: [evidenceClaim.id],
      sourceReferenceIds: [sourceReference.id]
    };
  });

  const achievements = collectSectionItems(sections, "achievements").map((item) => {
    const parsed = parseNamedDescription(item.text);
    const { sourceReference, evidenceClaim } = evidenceFor("achievement", item.section, item.text, item.text);

    return {
      id: randomUUID(),
      knowledgeAssetId,
      title: parsed.name,
      description: parsed.description,
      evidenceClaimIds: [evidenceClaim.id],
      sourceReferenceIds: [sourceReference.id]
    };
  });

  const document: CanonicalCareerDocument = {
    source,
    asset,
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

function parseFrontmatter(rawContent: string): {
  metadata: Record<string, string | string[]>;
  body: string;
} {
  if (!rawContent.startsWith("---\n")) {
    return { metadata: {}, body: rawContent };
  }

  const end = rawContent.indexOf("\n---", 4);
  if (end === -1) {
    return { metadata: {}, body: rawContent };
  }

  const frontmatter = rawContent.slice(4, end).trim();
  const metadata: Record<string, string | string[]> = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      metadata[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      metadata[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return {
    metadata,
    body: rawContent.slice(end + 4).replace(/^\r?\n/, "")
  };
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
