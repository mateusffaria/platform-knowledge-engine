import { eq } from "drizzle-orm";

import {
  StructuredKnowledgeSearch,
  StructuredKnowledgeSearchInput
} from "../../../retrieval/application/ports/structured-knowledge-search.js";
import { EvidenceClaimStatus, EvidenceClaimType, HybridSearchCandidate } from "../../../retrieval/application/types.js";
import {
  evidenceClaims,
  knowledgeAssets,
  sourceDocuments,
  sourceReferences
} from "../../../../shared/database/schema.js";

interface KnowledgeSearchDatabase {
  select: (...args: any[]) => any;
}

const eligibleClaimStatuses = new Set<EvidenceClaimStatus>(["confirmed", "single_source"]);

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.map(normalize).filter(Boolean)));
}

function calculateStructuredScore(row: any, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
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

function subjectTypeMatches(input: StructuredKnowledgeSearchInput, claimType: EvidenceClaimType): boolean {
  if (input.subjectType === undefined || input.subjectType === "evidence_claim") {
    return true;
  }

  return input.subjectType === claimType;
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
      .innerJoin(sourceReferences, eq(evidenceClaims.sourceReferenceId, sourceReferences.id));

    return rows
      .map((row: any) => ({
        row,
        score: calculateStructuredScore(row, terms)
      }))
      .filter(({ row, score }: any) => score > 0)
      .filter(({ row }: any) => eligibleClaimStatuses.has(row.status))
      .filter(({ row }: any) => input.claimStatus === undefined || row.status === input.claimStatus)
      .filter(({ row }: any) => subjectTypeMatches(input, row.claimType))
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
