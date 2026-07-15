import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  JobDescriptionWithRequirements,
  JobRequirementImportance,
  JobRequirementType,
  JobSourceType
} from "../../domain/model.js";
import { JobSourceParser } from "../../application/ports/job-source-parser.js";

interface SourceLine {
  text: string;
  line: number;
}

interface JobSection {
  label?: string;
  normalizedLabel: string;
  startLine: number;
  lines: SourceLine[];
}

interface SectionClassification {
  type?: JobRequirementType;
  importance?: JobRequirementImportance;
  isRequirementSection: boolean;
}

const supportedExtensions = new Set([".md", ".markdown", ".txt"]);
const technologyNames = new Map<string, string>([
  ["typescript", "TypeScript"],
  ["javascript", "JavaScript"],
  ["node.js", "Node.js"],
  ["nodejs", "Node.js"],
  ["python", "Python"],
  ["java", "Java"],
  ["c#", "C#"],
  ["c++", "C++"],
  ["react", "React"],
  ["next.js", "Next.js"],
  ["nextjs", "Next.js"],
  ["postgresql", "PostgreSQL"],
  ["postgres", "PostgreSQL"],
  ["mysql", "MySQL"],
  ["mongodb", "MongoDB"],
  ["docker", "Docker"],
  ["kubernetes", "Kubernetes"],
  ["aws", "AWS"],
  ["gcp", "GCP"],
  ["azure", "Azure"],
  ["terraform", "Terraform"],
  ["graphql", "GraphQL"],
  ["rest", "REST"],
  ["pgvector", "pgvector"]
]);
const skillNames = new Map<string, string>([
  ["communication", "communication"],
  ["leadership", "leadership"],
  ["collaboration", "collaboration"],
  ["stakeholder management", "stakeholder management"],
  ["problem solving", "problem solving"],
  ["mentoring", "mentoring"]
]);

export class DeterministicJobSourceParser implements JobSourceParser {
  async parse(sourcePath: string): Promise<JobDescriptionWithRequirements> {
    return parseJobSource(sourcePath, await readJobSource(sourcePath));
  }
}

export async function readJobSource(sourcePath: string): Promise<string> {
  validateJobSourcePath(sourcePath);
  try {
    return await readFile(sourcePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Job description source file not found: ${sourcePath}`);
    }
    throw error;
  }
}

export function validateJobSourcePath(sourcePath: string): void {
  if (!supportedExtensions.has(path.extname(sourcePath).toLowerCase())) {
    throw new Error("Only Markdown (.md, .markdown) and plain-text (.txt) job descriptions are supported.");
  }
}

export function parseJobSource(sourcePath: string, rawContent: string): JobDescriptionWithRequirements {
  if (rawContent.trim().length === 0) {
    throw new Error("Job description content must not be empty.");
  }

  const now = new Date();
  const jobDescriptionId = randomUUID();
  const { metadata, body, bodyStartLine } = parseFrontmatter(rawContent);
  const sections = splitSections(body, bodyStartLine);
  const sourceType = sourceTypeForPath(sourcePath);
  const title = metadata.title ?? findMarkdownTitle(body) ?? findPlainTextTitle(body);
  const requirements = sections.flatMap((section) => extractRequirements(section, jobDescriptionId));

  return {
    job: {
      id: jobDescriptionId,
      sourceType,
      sourcePath,
      rawContent,
      contentHash: createHash("sha256").update(rawContent, "utf8").digest("hex"),
      title,
      ingestedAt: now
    },
    requirements
  };
}

function sourceTypeForPath(sourcePath: string): JobSourceType {
  return path.extname(sourcePath).toLowerCase() === ".txt" ? "plain_text" : "markdown";
}

function parseFrontmatter(rawContent: string): { metadata: Record<string, string>; body: string; bodyStartLine: number } {
  if (!rawContent.startsWith("---\n")) {
    return { metadata: {}, body: rawContent, bodyStartLine: 1 };
  }
  const end = rawContent.indexOf("\n---", 4);
  if (end === -1) {
    return { metadata: {}, body: rawContent, bodyStartLine: 1 };
  }

  const metadata: Record<string, string> = {};
  for (const line of rawContent.slice(4, end).split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    metadata[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }

  return {
    metadata,
    body: rawContent.slice(end + 4).replace(/^\r?\n/, ""),
    bodyStartLine: rawContent.slice(0, end + 4).split(/\r?\n/).length + 1
  };
}

function splitSections(body: string, bodyStartLine: number): JobSection[] {
  const sections: JobSection[] = [{ normalizedLabel: "", startLine: bodyStartLine, lines: [] }];
  let current = sections[0];

  for (const [index, text] of body.split(/\r?\n/).entries()) {
    const line = bodyStartLine + index;
    const heading = /^(?:#{1,6}\s+)(.+?)\s*$/.exec(text);
    const plainHeading = /^([A-Za-z][A-Za-z0-9 &/\-]{2,80}):\s*$/.exec(text);
    const recognizedPlainHeading = isRecognizedSectionLabel(text) ? text.trim() : undefined;
    if (heading || plainHeading || recognizedPlainHeading) {
      const label = heading?.[1] ?? plainHeading?.[1] ?? recognizedPlainHeading!;
      current = { label, normalizedLabel: normalize(label), startLine: line, lines: [] };
      sections.push(current);
      continue;
    }
    current.lines.push({ text, line });
  }

  return sections;
}

function extractRequirements(section: JobSection, jobDescriptionId: string): JobDescriptionWithRequirements["requirements"] {
  const classification = classifySection(section.normalizedLabel);
  const items = collectItems(section);
  return items.flatMap((item) => {
    const itemClassification = classifyItem(item.text, classification);
    if (!classification.isRequirementSection && !itemClassification.explicit) {
      return [];
    }

    const type = classification.type ?? itemClassification.type ?? "skill";
    const importance = classification.importance ?? itemClassification.importance ?? "required";
    const inferred = itemClassification.inferred
      || (classification.type === undefined && itemClassification.type === undefined)
      || (classification.importance === undefined && itemClassification.importance === undefined);
    return [{
      id: randomUUID(),
      jobDescriptionId,
      requirementType: type,
      importance,
      normalizedValue: itemClassification.normalizedValue,
      originalText: item.text,
      sourceExcerpt: item.text,
      sourceLocation: { startLine: item.startLine, endLine: item.endLine },
      sectionLabel: section.label,
      inferred
    }];
  });
}

function collectItems(section: JobSection): Array<{ text: string; startLine: number; endLine: number }> {
  const items: Array<{ text: string; startLine: number; endLine: number }> = [];
  let paragraph: SourceLine[] = [];
  const flushParagraph = () => {
    const text = paragraph.map((line) => line.text.trim()).join(" ").trim();
    if (text) {
      items.push({ text, startLine: paragraph[0].line, endLine: paragraph.at(-1)!.line });
    }
    paragraph = [];
  };

  for (const line of section.lines) {
    const bullet = /^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/.exec(line.text);
    if (bullet) {
      flushParagraph();
      items.push({ text: bullet[1], startLine: line.line, endLine: line.line });
      continue;
    }
    if (line.text.trim().length === 0) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return items;
}

function classifySection(label: string): SectionClassification {
  if (/nice to have|nice-to-have|preferred|bonus|desirable/.test(label)) {
    return { importance: "preferred", isRequirementSection: true };
  }
  if (/responsibilit|what you('|’)ll do|duties/.test(label)) {
    return { type: "responsibility", importance: "required", isRequirementSection: true };
  }
  if (/requirements?|qualifications?|what you('|’)ll bring|skills?/.test(label)) {
    return { importance: "required", isRequirementSection: true };
  }
  return { isRequirementSection: false };
}

function isRecognizedSectionLabel(value: string): boolean {
  const normalized = normalize(value);
  return normalized.length > 0 && classifySection(normalized).isRequirementSection;
}

function classifyItem(text: string, section: SectionClassification): {
  type?: JobRequirementType;
  importance?: JobRequirementImportance;
  normalizedValue?: string;
  explicit: boolean;
  inferred: boolean;
} {
  const lower = normalize(text);
  const explicitImportance = /\b(preferred|nice to have|bonus|desirable)\b/.test(lower)
    ? "preferred"
    : /\b(required|must have|must|mandatory)\b/.test(lower)
      ? "required"
      : undefined;
  const technology = matchingName(lower, technologyNames);
  if (technology) {
    return { type: "technology", importance: explicitImportance, normalizedValue: technology, explicit: true, inferred: false };
  }
  const skill = matchingName(lower, skillNames);
  if (skill) {
    return { type: "skill", importance: explicitImportance, normalizedValue: skill, explicit: true, inferred: false };
  }
  if (/\b\d+\+?\s+years?\b|\byears? of experience\b|\bexperience (with|in)\b/.test(lower)) {
    return { type: "experience", importance: explicitImportance, explicit: true, inferred: false };
  }
  if (/\b(bachelor|master|ph\.?d|degree|university)\b/.test(lower)) {
    return { type: "education", importance: explicitImportance, explicit: true, inferred: false };
  }
  if (/\b(english|portuguese|spanish|french|german|fluent|language)\b/.test(lower)) {
    return { type: "language", importance: explicitImportance, explicit: true, inferred: false };
  }
  if (/\b(junior|mid-level|senior|staff|principal|lead)\b/.test(lower)) {
    return { type: "seniority", importance: explicitImportance, explicit: true, inferred: false };
  }
  if (/\b(fintech|healthcare|e-commerce|ecommerce|saas|banking|education)\b/.test(lower)) {
    return { type: "domain", importance: explicitImportance, explicit: true, inferred: false };
  }
  if (section.type === "responsibility" || /^(build|design|lead|collaborate|deliver|develop|manage|own)\b/.test(lower)) {
    return { type: "responsibility", importance: explicitImportance, explicit: section.type === "responsibility", inferred: section.type !== "responsibility" };
  }

  return { importance: explicitImportance, explicit: explicitImportance !== undefined, inferred: true };
}

function matchingName(text: string, names: Map<string, string>): string | undefined {
  for (const [candidate, normalized] of names) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text)) {
      return normalized;
    }
  }
  return undefined;
}

function findMarkdownTitle(body: string): string | undefined {
  return /^#\s+(.+?)\s*$/m.exec(body)?.[1];
}

function findPlainTextTitle(body: string): string | undefined {
  const line = body.split(/\r?\n/).find((candidate) => {
    const trimmed = candidate.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.endsWith(":");
  })?.trim();
  return line && line.length <= 120 ? line : undefined;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
