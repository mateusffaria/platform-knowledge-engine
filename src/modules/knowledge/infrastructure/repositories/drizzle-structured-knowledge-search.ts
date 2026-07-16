import { eq } from "drizzle-orm";

import {
  StructuredKnowledgeSearch,
  StructuredKnowledgeSearchInput
} from "../../../retrieval/application/ports/structured-knowledge-search.js";
import {
  HybridSearchCandidate,
  SearchFilter
} from "../../../retrieval/application/types.js";
import {
  evidenceClaims,
  experiences,
  knowledgeAssets,
  projects,
  skills,
  sourceDocuments,
  sourceReferences
} from "../../../../shared/database/schema.js";

interface KnowledgeSearchDatabase {
  select: (...args: any[]) => any;
}

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.map(normalize).filter(Boolean)));
}

function calculateStructuredScore(row: any, terms: string[], hasFilters: boolean): number {
  if (terms.length === 0) {
    return hasFilters ? 1 : 0;
  }

  const searchableText = normalize([
    row.claimText,
    row.claimType,
    row.claimCategory,
    row.predicate,
    row.valueText,
    row.valueUnit,
    row.assetTitle,
    row.assetSummary,
    row.referenceSection,
    row.referenceLocator,
    row.referenceExcerpt,
    row.sourcePath
  ].filter(Boolean).join(" "));
  const matches = terms.filter((term) => searchableText.includes(term)).length;

  return Number((matches / terms.length).toFixed(6));
}

function filterValue(filter: SearchFilter): string {
  return normalize(filter.value.value);
}

function isQuotedTextFilter(filter: SearchFilter): boolean {
  return filter.value.kind === "text" && /^["']/.test(filter.value.rawValue);
}

function matchesTextFilter(candidate: string | undefined, filter: SearchFilter): boolean {
  const normalizedCandidate = normalize(candidate);
  const value = filterValue(filter);
  return isQuotedTextFilter(filter)
    ? normalizedCandidate === value
    : normalizedCandidate.startsWith(value);
}

function parseDateStart(value: string): Date {
  const [year, month = "01", day = "01"] = value.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function parseDateEnd(value: string): Date {
  const [year, month, day] = value.split("-");
  if (month === undefined) {
    return new Date(Date.UTC(Number(year), 11, 31));
  }
  if (day === undefined) {
    return new Date(Date.UTC(Number(year), Number(month), 0));
  }
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function matchesDateAfter(row: any, value: string): boolean {
  const experienceEnd = row.experienceEndDate ?? row.experienceStartDate;
  return experienceEnd !== undefined && parseDateEnd(experienceEnd) >= parseDateStart(value);
}

function matchesDateBefore(row: any, value: string): boolean {
  const experienceStart = row.experienceStartDate ?? row.experienceEndDate;
  return experienceStart !== undefined && parseDateStart(experienceStart) <= parseDateEnd(value);
}

function matchesFilter(row: any, filter: SearchFilter): boolean {
  const value = filterValue(filter);
  switch (filter.field) {
    case "company":
      return matchesTextFilter(row.experienceOrganization, filter);
    case "role":
      return matchesTextFilter(row.experienceRole, filter);
    case "technology":
      return Array.isArray(row.projectTechnologies)
        && row.projectTechnologies.some((technology: string) => matchesTextFilter(technology, filter));
    case "skill":
      return matchesTextFilter(row.skillName, filter);
    case "project":
      return matchesTextFilter(row.projectName, filter);
    case "status":
      return normalize(row.status) === value;
    case "type":
      return value === "evidence_claim" || normalize(row.claimType) === value;
    case "after":
      return matchesDateAfter(row, filter.value.value);
    case "before":
      return matchesDateBefore(row, filter.value.value);
  }
}

function matchesFilters(row: any, filters: SearchFilter[]): boolean {
  return filters.every((filter) => matchesFilter(row, filter));
}

export class DrizzleStructuredKnowledgeSearch implements StructuredKnowledgeSearch {
  constructor(private readonly db: KnowledgeSearchDatabase) {}

  async search(input: StructuredKnowledgeSearchInput): Promise<HybridSearchCandidate[]> {
    const terms = uniqueTerms(input.terms);
    const rows = await this.db
      .select({
        id: evidenceClaims.id,
        knowledgeAssetId: evidenceClaims.knowledgeAssetId,
        subjectAssetId: evidenceClaims.subjectAssetId,
        sourceReferenceId: evidenceClaims.sourceReferenceId,
        claimType: evidenceClaims.claimType,
        claimCategory: evidenceClaims.claimCategory,
        predicate: evidenceClaims.predicate,
        claimText: evidenceClaims.claimText,
        relatedAssetId: evidenceClaims.relatedAssetId,
        valueText: evidenceClaims.valueText,
        valueUnit: evidenceClaims.valueUnit,
        sourceLanguage: evidenceClaims.sourceLanguage,
        originalSectionLabel: evidenceClaims.originalSectionLabel,
        status: evidenceClaims.status,
        confidenceScore: evidenceClaims.confidenceScore,
        experienceRole: experiences.role,
        experienceOrganization: experiences.organization,
        experienceStartDate: experiences.startDate,
        experienceEndDate: experiences.endDate,
        projectName: projects.name,
        projectTechnologies: projects.technologies,
        skillName: skills.name,
        assetTitle: knowledgeAssets.title,
        assetSummary: knowledgeAssets.summary,
        sourceDocumentId: sourceDocuments.id,
        sourcePath: sourceDocuments.path,
        referenceId: sourceReferences.id,
        referenceSourceDocumentId: sourceReferences.sourceDocumentId,
        referenceSection: sourceReferences.section,
        referenceLocator: sourceReferences.locator,
        referenceExcerpt: sourceReferences.excerpt,
        referenceSourceLanguage: sourceReferences.sourceLanguage,
        referenceOriginalSectionLabel: sourceReferences.originalSectionLabel
      })
      .from(evidenceClaims)
      .innerJoin(knowledgeAssets, eq(evidenceClaims.knowledgeAssetId, knowledgeAssets.id))
      .innerJoin(sourceDocuments, eq(knowledgeAssets.sourceDocumentId, sourceDocuments.id))
      .innerJoin(sourceReferences, eq(evidenceClaims.sourceReferenceId, sourceReferences.id))
      .leftJoin(experiences, eq(experiences.evidenceClaimId, evidenceClaims.id))
      .leftJoin(projects, eq(projects.evidenceClaimId, evidenceClaims.id))
      .leftJoin(skills, eq(skills.evidenceClaimId, evidenceClaims.id));

    return rows
      .filter((row: any) => matchesFilters(row, input.filters))
      .map((row: any) => ({
        row,
        score: calculateStructuredScore(row, terms, input.filters.length > 0)
      }))
      .filter(({ row, score }: any) => score > 0)
      .filter(({ score }: any) => input.minStructuredScore === undefined || score >= input.minStructuredScore)
      .sort((left: any, right: any) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.row.id.localeCompare(right.row.id);
      })
      .slice(0, input.limit)
      .map(({ row, score }: any) => ({
        evidenceClaimId: row.id,
        knowledgeAssetId: row.knowledgeAssetId,
        subjectAssetId: row.subjectAssetId,
        subjectType: row.claimType,
        claimType: row.claimType,
        claimCategory: row.claimCategory,
        predicate: row.predicate,
        claimText: row.claimText,
        relatedAssetId: row.relatedAssetId ?? undefined,
        valueText: row.valueText ?? undefined,
        valueUnit: row.valueUnit ?? undefined,
        claimStatus: row.status,
        confidenceScore: row.confidenceScore,
        structuredScore: score,
        sources: [{
          id: row.referenceId,
          sourceDocumentId: row.referenceSourceDocumentId,
          section: row.referenceSection,
          locator: row.referenceLocator,
          excerpt: row.referenceExcerpt,
          sourcePath: row.sourcePath,
          sourceLanguage: row.sourceLanguage ?? row.referenceSourceLanguage ?? undefined,
          originalSectionLabel: row.originalSectionLabel ?? row.referenceOriginalSectionLabel
        }],
        retrievalStrategies: ["structured"]
      }));
  }
}
