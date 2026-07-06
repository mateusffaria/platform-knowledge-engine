import { KnowledgePersistence } from "../../application/ports/knowledge-persistence.js";
import { assertCanonicalCareerDocument, CanonicalCareerDocument } from "../../domain/model.js";
import {
  achievements,
  evidenceClaims,
  experiences,
  knowledgeAssets,
  projects,
  skills,
  sourceDocuments,
  sourceReferences
} from "../../../../shared/database/schema.js";

export class DrizzleKnowledgePersistence implements KnowledgePersistence {
  constructor(private readonly db: { transaction: <T>(handler: (tx: any) => Promise<T>) => Promise<T> }) {}

  async saveCanonicalCareerDocument(document: CanonicalCareerDocument): Promise<void> {
    assertCanonicalCareerDocument(document);

    await this.db.transaction(async (tx) => {
      await tx.insert(sourceDocuments).values(document.source);
      await tx.insert(knowledgeAssets).values(document.asset);

      if (document.references.length > 0) {
        await tx.insert(sourceReferences).values(document.references);
      }

      if (document.evidenceClaims.length > 0) {
        await tx.insert(evidenceClaims).values(document.evidenceClaims);
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
