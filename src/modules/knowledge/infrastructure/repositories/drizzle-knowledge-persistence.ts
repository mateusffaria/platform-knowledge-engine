import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { KnowledgePersistence } from "../../application/ports/knowledge-persistence.js";
import { assertCanonicalCareerDocument, CanonicalCareerDocument } from "../../domain/model.js";
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

interface KnowledgeDatabase {
  select: (...args: any[]) => any;
  transaction: <T>(handler: (tx: any) => Promise<T>) => Promise<T>;
}

export class DrizzleKnowledgePersistence implements KnowledgePersistence {
  constructor(private readonly db: KnowledgeDatabase) {}

  async hasSourceDocumentVersion(identity: { path: string; contentHash: string }): Promise<boolean> {
    const existing = await this.db
      .select({ id: sourceDocuments.id })
      .from(sourceDocuments)
      .where(and(eq(sourceDocuments.path, identity.path), eq(sourceDocuments.contentHash, identity.contentHash)))
      .limit(1);

    return existing.length > 0;
  }

  async saveCanonicalCareerDocument(document: CanonicalCareerDocument): Promise<void> {
    assertCanonicalCareerDocument(document);

    await this.db.transaction(async (tx) => {
      const insertedSourceDocuments = await tx
        .insert(sourceDocuments)
        .values(document.source)
        .onConflictDoNothing({
          target: [sourceDocuments.path, sourceDocuments.contentHash]
        })
        .returning({ id: sourceDocuments.id });

      if (insertedSourceDocuments.length === 0) {
        return;
      }

      await tx.insert(knowledgeAssets).values(document.assets);

      if (document.references.length > 0) {
        await tx.insert(sourceReferences).values(document.references);
      }

      if (document.evidenceClaims.length > 0) {
        await tx.insert(evidenceClaims).values(document.evidenceClaims);
        await tx.insert(claimStatusEvents).values(
          document.evidenceClaims.map((claim) => ({
            id: randomUUID(),
            evidenceClaimId: claim.id,
            previousStatus: null,
            nextStatus: claim.status,
            reason: claim.reviewReason ?? "Initial claim status assigned during ingestion.",
            transitionSource: "system" as const,
            createdAt: document.source.ingestedAt
          }))
        );
      }

      if (document.skills.length > 0) {
        await tx.insert(skills).values(
          document.skills.map((skill) => ({
            id: skill.id,
            knowledgeAssetId: skill.knowledgeAssetId,
            evidenceClaimId: skill.evidenceClaimIds[0],
            sourceReferenceId: skill.sourceReferenceIds[0],
            name: skill.name,
            category: skill.category
          }))
        );
      }

      if (document.experiences.length > 0) {
        await tx.insert(experiences).values(
          document.experiences.map((experience) => ({
            id: experience.id,
            knowledgeAssetId: experience.knowledgeAssetId,
            evidenceClaimId: experience.evidenceClaimIds[0],
            sourceReferenceId: experience.sourceReferenceIds[0],
            role: experience.role,
            organization: experience.organization,
            startDate: experience.startDate,
            endDate: experience.endDate,
            description: experience.description
          }))
        );
      }

      if (document.projects.length > 0) {
        await tx.insert(projects).values(
          document.projects.map((project) => ({
            id: project.id,
            knowledgeAssetId: project.knowledgeAssetId,
            evidenceClaimId: project.evidenceClaimIds[0],
            sourceReferenceId: project.sourceReferenceIds[0],
            name: project.name,
            description: project.description,
            technologies: project.technologies
          }))
        );
      }

      if (document.achievements.length > 0) {
        await tx.insert(achievements).values(
          document.achievements.map((achievement) => ({
            id: achievement.id,
            knowledgeAssetId: achievement.knowledgeAssetId,
            evidenceClaimId: achievement.evidenceClaimIds[0],
            sourceReferenceId: achievement.sourceReferenceIds[0],
            title: achievement.title,
            description: achievement.description
          }))
        );
      }
    });
  }
}
