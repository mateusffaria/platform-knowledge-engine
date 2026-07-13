import { eq } from "drizzle-orm";

import {
  IndexableEvidenceClaim,
  IndexableKnowledgeAsset,
  IndexableKnowledgeReader
} from "../../application/ports/indexable-knowledge-reader.js";
import {
  evidenceClaims,
  knowledgeAssets,
  sourceDocuments,
  sourceReferences
} from "../../../../shared/database/schema.js";

interface KnowledgeReadDatabase {
  select: (...args: any[]) => any;
}

export class DrizzleIndexableKnowledgeReader implements IndexableKnowledgeReader {
  constructor(private readonly db: KnowledgeReadDatabase) {}

  async listIndexableKnowledgeAssets(): Promise<IndexableKnowledgeAsset[]> {
    const rows = await this.db
      .select({
        id: knowledgeAssets.id,
        sourceDocumentId: knowledgeAssets.sourceDocumentId,
        assetType: knowledgeAssets.assetType,
        title: knowledgeAssets.title,
        summary: knowledgeAssets.summary,
        createdAt: knowledgeAssets.createdAt,
        sourceId: sourceDocuments.id,
        sourcePath: sourceDocuments.path,
        sourceContentHash: sourceDocuments.contentHash,
        sourceType: sourceDocuments.sourceType
      })
      .from(knowledgeAssets)
      .innerJoin(sourceDocuments, eq(knowledgeAssets.sourceDocumentId, sourceDocuments.id));

    return rows.map((row: any) => ({
      id: row.id,
      sourceDocumentId: row.sourceDocumentId,
      assetType: row.assetType,
      title: row.title,
      summary: row.summary ?? undefined,
      createdAt: row.createdAt,
      source: {
        id: row.sourceId,
        path: row.sourcePath,
        contentHash: row.sourceContentHash,
        sourceType: row.sourceType
      }
    }));
  }

  async listIndexableEvidenceClaims(): Promise<IndexableEvidenceClaim[]> {
    const rows = await this.db
      .select({
        id: evidenceClaims.id,
        knowledgeAssetId: evidenceClaims.knowledgeAssetId,
        sourceReferenceId: evidenceClaims.sourceReferenceId,
        claimType: evidenceClaims.claimType,
        claimText: evidenceClaims.claimText,
        status: evidenceClaims.status,
        confidenceScore: evidenceClaims.confidenceScore,
        conflictSeverity: evidenceClaims.conflictSeverity,
        reviewedAt: evidenceClaims.reviewedAt,
        reviewReason: evidenceClaims.reviewReason,
        assetTitle: knowledgeAssets.title,
        assetSummary: knowledgeAssets.summary,
        assetType: knowledgeAssets.assetType,
        assetSourceDocumentId: knowledgeAssets.sourceDocumentId,
        sourceId: sourceDocuments.id,
        sourcePath: sourceDocuments.path,
        sourceContentHash: sourceDocuments.contentHash,
        sourceType: sourceDocuments.sourceType,
        referenceId: sourceReferences.id,
        referenceSourceDocumentId: sourceReferences.sourceDocumentId,
        referenceSection: sourceReferences.section,
        referenceLocator: sourceReferences.locator,
        referenceExcerpt: sourceReferences.excerpt
      })
      .from(evidenceClaims)
      .innerJoin(knowledgeAssets, eq(evidenceClaims.knowledgeAssetId, knowledgeAssets.id))
      .innerJoin(sourceDocuments, eq(knowledgeAssets.sourceDocumentId, sourceDocuments.id))
      .innerJoin(sourceReferences, eq(evidenceClaims.sourceReferenceId, sourceReferences.id));

    return rows.map((row: any) => ({
      id: row.id,
      knowledgeAssetId: row.knowledgeAssetId,
      sourceReferenceId: row.sourceReferenceId,
      claimType: row.claimType,
      claimText: row.claimText,
      status: row.status,
      confidenceScore: row.confidenceScore,
      conflictSeverity: row.conflictSeverity,
      reviewedAt: row.reviewedAt ?? undefined,
      reviewReason: row.reviewReason ?? undefined,
      asset: {
        id: row.knowledgeAssetId,
        title: row.assetTitle,
        summary: row.assetSummary ?? undefined,
        assetType: row.assetType,
        sourceDocumentId: row.assetSourceDocumentId
      },
      source: {
        id: row.sourceId,
        path: row.sourcePath,
        contentHash: row.sourceContentHash,
        sourceType: row.sourceType
      },
      reference: {
        id: row.referenceId,
        sourceDocumentId: row.referenceSourceDocumentId,
        section: row.referenceSection,
        locator: row.referenceLocator,
        excerpt: row.referenceExcerpt
      },
      verified: row.status === "confirmed"
    }));
  }
}
