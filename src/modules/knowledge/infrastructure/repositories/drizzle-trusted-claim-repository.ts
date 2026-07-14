import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  ClaimAssessmentCandidate,
  ClaimAssessmentUpdate,
  ClaimReviewItem,
  ClaimStatusTransition,
  ClaimReconciliationRepository
} from "../../../reconciliation/application/ports/claim-reconciliation-repository.js";
import { StructuredClaimFields } from "../../../reconciliation/domain/model.js";
import {
  achievements,
  claimStatusEvents,
  evidenceClaims,
  experiences,
  knowledgeAssets,
  projects,
  skills,
  sourceDocuments,
  sourceReferences
} from "../../../../shared/database/schema.js";

interface TrustedClaimDatabase {
  select: (...args: any[]) => any;
  update: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  transaction: <T>(handler: (tx: any) => Promise<T>) => Promise<T>;
}

export class DrizzleTrustedClaimRepository implements ClaimReconciliationRepository {
  constructor(private readonly db: TrustedClaimDatabase) {}

  async listAssessmentCandidates(): Promise<ClaimAssessmentCandidate[]> {
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
        conflictSeverity: evidenceClaims.conflictSeverity,
        reviewedAt: evidenceClaims.reviewedAt,
        reviewReason: evidenceClaims.reviewReason,
        sourceDocumentId: sourceDocuments.id,
        sourcePath: sourceDocuments.path,
        sourceReliability: sourceDocuments.sourceReliability,
        sourceReferenceSection: sourceReferences.section,
        sourceReferenceLocator: sourceReferences.locator,
        sourceReferenceExcerpt: sourceReferences.excerpt,
        skillName: skills.name,
        skillCategory: skills.category,
        experienceRole: experiences.role,
        experienceOrganization: experiences.organization,
        experienceStartDate: experiences.startDate,
        experienceEndDate: experiences.endDate,
        projectName: projects.name,
        projectDescription: projects.description,
        achievementTitle: achievements.title,
        achievementDescription: achievements.description
      })
      .from(evidenceClaims)
      .innerJoin(knowledgeAssets, eq(evidenceClaims.knowledgeAssetId, knowledgeAssets.id))
      .innerJoin(sourceDocuments, eq(knowledgeAssets.sourceDocumentId, sourceDocuments.id))
      .innerJoin(sourceReferences, eq(evidenceClaims.sourceReferenceId, sourceReferences.id))
      .leftJoin(skills, eq(skills.evidenceClaimId, evidenceClaims.id))
      .leftJoin(experiences, eq(experiences.evidenceClaimId, evidenceClaims.id))
      .leftJoin(projects, eq(projects.evidenceClaimId, evidenceClaims.id))
      .leftJoin(achievements, eq(achievements.evidenceClaimId, evidenceClaims.id));

    return rows.map((row: any) => ({
      id: row.id,
      knowledgeAssetId: row.knowledgeAssetId,
      subjectAssetId: row.subjectAssetId,
      sourceReferenceId: row.sourceReferenceId,
      claimType: row.claimType,
      claimCategory: row.claimCategory,
      predicate: row.predicate,
      claimText: row.claimText,
      relatedAssetId: row.relatedAssetId ?? undefined,
      valueText: row.valueText ?? undefined,
      valueUnit: row.valueUnit ?? undefined,
      sourceLanguage: row.sourceLanguage ?? undefined,
      originalSectionLabel: row.originalSectionLabel,
      status: row.status,
      confidenceScore: row.confidenceScore,
      conflictSeverity: row.conflictSeverity,
      reviewedAt: row.reviewedAt ?? undefined,
      reviewReason: row.reviewReason ?? undefined,
      sourceDocumentId: row.sourceDocumentId,
      sourcePath: row.sourcePath,
      sourceReliability: row.sourceReliability,
      sourceReferenceSection: row.sourceReferenceSection,
      sourceReferenceLocator: row.sourceReferenceLocator,
      sourceReferenceExcerpt: row.sourceReferenceExcerpt,
      structured: structuredFields(row)
    }));
  }

  async updateClaimAssessment(update: ClaimAssessmentUpdate): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({
          status: evidenceClaims.status,
          confidenceScore: evidenceClaims.confidenceScore,
          conflictSeverity: evidenceClaims.conflictSeverity,
          reviewReason: evidenceClaims.reviewReason
        })
        .from(evidenceClaims)
        .where(eq(evidenceClaims.id, update.claimId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error(`Evidence claim not found: ${update.claimId}`);
      }

      await tx
        .update(evidenceClaims)
        .set({
          status: update.status,
          confidenceScore: update.confidenceScore,
          conflictSeverity: update.conflictSeverity,
          reviewReason: update.reviewReason ?? null
        })
        .where(eq(evidenceClaims.id, update.claimId));

      if (existing[0].status !== update.status) {
        await tx.insert(claimStatusEvents).values({
          id: randomUUID(),
          evidenceClaimId: update.claimId,
          previousStatus: existing[0].status,
          nextStatus: update.status,
          reason: update.reviewReason ?? null,
          transitionSource: update.transitionSource,
          createdAt: new Date()
        });
      }
    });
  }

  async listClaimsRequiringReview(): Promise<ClaimReviewItem[]> {
    const rows = await this.db
      .select({
        id: evidenceClaims.id,
        status: evidenceClaims.status,
        confidenceScore: evidenceClaims.confidenceScore,
        conflictSeverity: evidenceClaims.conflictSeverity,
        reviewReason: evidenceClaims.reviewReason,
        claimType: evidenceClaims.claimType,
        claimCategory: evidenceClaims.claimCategory,
        predicate: evidenceClaims.predicate,
        claimText: evidenceClaims.claimText,
        subjectAssetId: evidenceClaims.subjectAssetId,
        relatedAssetId: evidenceClaims.relatedAssetId,
        valueText: evidenceClaims.valueText,
        valueUnit: evidenceClaims.valueUnit,
        sourceLanguage: evidenceClaims.sourceLanguage,
        originalSectionLabel: evidenceClaims.originalSectionLabel,
        sourcePath: sourceDocuments.path,
        sourceReferenceSection: sourceReferences.section,
        sourceReferenceLocator: sourceReferences.locator,
        sourceReferenceExcerpt: sourceReferences.excerpt
      })
      .from(evidenceClaims)
      .innerJoin(knowledgeAssets, eq(evidenceClaims.knowledgeAssetId, knowledgeAssets.id))
      .innerJoin(sourceDocuments, eq(knowledgeAssets.sourceDocumentId, sourceDocuments.id))
      .innerJoin(sourceReferences, eq(evidenceClaims.sourceReferenceId, sourceReferences.id))
      .where(eq(evidenceClaims.status, "needs_review"));

    return rows.map((row: any) => ({
      id: row.id,
      status: row.status,
      confidenceScore: row.confidenceScore,
      conflictSeverity: row.conflictSeverity,
      reviewReason: row.reviewReason ?? undefined,
      claimType: row.claimType,
      claimCategory: row.claimCategory,
      predicate: row.predicate,
      claimText: row.claimText,
      subjectAssetId: row.subjectAssetId,
      relatedAssetId: row.relatedAssetId ?? undefined,
      valueText: row.valueText ?? undefined,
      valueUnit: row.valueUnit ?? undefined,
      sourceLanguage: row.sourceLanguage ?? undefined,
      originalSectionLabel: row.originalSectionLabel,
      sourcePath: row.sourcePath,
      sourceReferenceSection: row.sourceReferenceSection,
      sourceReferenceLocator: row.sourceReferenceLocator,
      sourceReferenceExcerpt: row.sourceReferenceExcerpt
    }));
  }

  async transitionClaimStatus(transition: ClaimStatusTransition): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ status: evidenceClaims.status })
        .from(evidenceClaims)
        .where(eq(evidenceClaims.id, transition.claimId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error(`Evidence claim not found: ${transition.claimId}`);
      }

      await tx
        .update(evidenceClaims)
        .set({
          status: transition.nextStatus,
          confidenceScore: transition.confidenceScore,
          conflictSeverity: transition.conflictSeverity,
          reviewedAt: transition.reviewedAt ?? new Date(),
          reviewReason: transition.reason
        })
        .where(eq(evidenceClaims.id, transition.claimId));

      await tx.insert(claimStatusEvents).values({
        id: randomUUID(),
        evidenceClaimId: transition.claimId,
        previousStatus: existing[0].status,
        nextStatus: transition.nextStatus,
        reason: transition.reason,
        transitionSource: transition.transitionSource,
        createdAt: transition.reviewedAt ?? new Date()
      });
    });
  }
}

function structuredFields(row: any): StructuredClaimFields {
  return {
    skillName: row.skillName ?? undefined,
    skillCategory: row.skillCategory ?? undefined,
    experienceRole: row.experienceRole ?? undefined,
    experienceOrganization: row.experienceOrganization ?? undefined,
    experienceStartDate: row.experienceStartDate ?? undefined,
    experienceEndDate: row.experienceEndDate ?? undefined,
    projectName: row.projectName ?? undefined,
    projectDescription: row.projectDescription ?? undefined,
    achievementTitle: row.achievementTitle ?? undefined,
    achievementDescription: row.achievementDescription ?? undefined
  };
}
