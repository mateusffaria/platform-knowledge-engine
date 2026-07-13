import { describe, expect, it, vi } from "vitest";

import {
  ClaimAssessmentCandidate,
  ClaimAssessmentUpdate,
  ClaimReviewItem,
  ClaimStatusTransition,
  ClaimReconciliationRepository
} from "../src/modules/reconciliation/application/ports/claim-reconciliation-repository.js";
import { createAssessClaimsUseCase } from "../src/modules/reconciliation/application/use-cases/assess-claims.js";
import { createConfirmClaimUseCase } from "../src/modules/reconciliation/application/use-cases/confirm-claim.js";
import { createRejectClaimUseCase } from "../src/modules/reconciliation/application/use-cases/reject-claim.js";
import { assessClaimCandidates } from "../src/modules/reconciliation/domain/assessment.js";

function candidate(overrides: Partial<ClaimAssessmentCandidate>): ClaimAssessmentCandidate {
  return {
    id: "claim-1",
    knowledgeAssetId: "asset-1",
    sourceReferenceId: "reference-1",
    claimType: "skill",
    claimText: "TypeScript",
    status: "single_source",
    confidenceScore: 50,
    conflictSeverity: "none",
    sourceDocumentId: "source-1",
    sourcePath: "source-1.md",
    sourceReliability: 50,
    sourceReferenceSection: "Skills",
    sourceReferenceLocator: "line:1",
    sourceReferenceExcerpt: "TypeScript",
    structured: {
      skillName: "TypeScript"
    },
    ...overrides
  };
}

class RecordingTrustedClaimRepository implements ClaimReconciliationRepository {
  public assessmentUpdates: ClaimAssessmentUpdate[] = [];
  public transitions: ClaimStatusTransition[] = [];

  constructor(private readonly candidates: ClaimAssessmentCandidate[] = []) {}

  async listAssessmentCandidates(): Promise<ClaimAssessmentCandidate[]> {
    return this.candidates;
  }

  async updateClaimAssessment(update: ClaimAssessmentUpdate): Promise<void> {
    this.assessmentUpdates.push(update);
  }

  async listClaimsRequiringReview(): Promise<ClaimReviewItem[]> {
    return [];
  }

  async transitionClaimStatus(transition: ClaimStatusTransition): Promise<void> {
    this.transitions.push(transition);
  }
}

describe("Trusted knowledge validation", () => {
  it("does not treat missing evidence as a conflict", () => {
    const decisions = assessClaimCandidates([
      candidate({
        id: "claim-go",
        claimText: "Go",
        sourceDocumentId: "source-1",
        structured: { skillName: "Go" }
      }),
      candidate({
        id: "claim-typescript",
        claimText: "TypeScript",
        sourceDocumentId: "source-2",
        structured: { skillName: "TypeScript" }
      })
    ]);

    expect(decisions).toEqual([
      expect.objectContaining({ claimId: "claim-go", status: "single_source", conflictSeverity: "none" }),
      expect.objectContaining({ claimId: "claim-typescript", status: "single_source", conflictSeverity: "none" })
    ]);
  });

  it("uses source reliability to adjust single-source confidence", async () => {
    const repository = new RecordingTrustedClaimRepository([
      candidate({
        id: "claim-high-trust",
        sourceReliability: 80,
        structured: { skillName: "TypeScript" }
      })
    ]);
    const useCase = createAssessClaimsUseCase(repository);

    await useCase.execute();

    expect(repository.assessmentUpdates).toEqual([
      expect.objectContaining({
        claimId: "claim-high-trust",
        status: "single_source",
        confidenceScore: 80,
        conflictSeverity: "none"
      })
    ]);
  });

  it("marks compatible claims from multiple sources as confirmed", () => {
    const decisions = assessClaimCandidates([
      candidate({
        id: "claim-typescript-1",
        sourceDocumentId: "source-1",
        sourceReliability: 70,
        structured: { skillName: "TypeScript" }
      }),
      candidate({
        id: "claim-typescript-2",
        sourceDocumentId: "source-2",
        sourceReliability: 65,
        structured: { skillName: "TypeScript" }
      })
    ]);

    expect(decisions).toEqual([
      expect.objectContaining({ claimId: "claim-typescript-1", status: "confirmed", conflictSeverity: "none" }),
      expect.objectContaining({ claimId: "claim-typescript-2", status: "confirmed", conflictSeverity: "none" })
    ]);
  });

  it("marks low-severity structured differences as needing review", () => {
    const decisions = assessClaimCandidates([
      candidate({
        id: "project-1",
        claimType: "project",
        claimText: "Atlas: migration tooling",
        sourceDocumentId: "source-1",
        structured: { projectName: "Atlas", projectDescription: "migration tooling" }
      }),
      candidate({
        id: "project-2",
        claimType: "project",
        claimText: "Atlas: observability tooling",
        sourceDocumentId: "source-2",
        structured: { projectName: "Atlas", projectDescription: "observability tooling" }
      })
    ]);

    expect(decisions).toEqual([
      expect.objectContaining({ claimId: "project-1", status: "needs_review", conflictSeverity: "low" }),
      expect.objectContaining({ claimId: "project-2", status: "needs_review", conflictSeverity: "low" })
    ]);
  });

  it("marks contradictory experience dates as high-severity review items", () => {
    const decisions = assessClaimCandidates([
      candidate({
        id: "experience-1",
        claimType: "experience",
        claimText: "Staff Engineer at Acme (2020-2023)",
        sourceDocumentId: "source-1",
        structured: {
          experienceRole: "Staff Engineer",
          experienceOrganization: "Acme",
          experienceStartDate: "2020",
          experienceEndDate: "2023"
        }
      }),
      candidate({
        id: "experience-2",
        claimType: "experience",
        claimText: "Staff Engineer at Acme (2021-2024)",
        sourceDocumentId: "source-2",
        structured: {
          experienceRole: "Staff Engineer",
          experienceOrganization: "Acme",
          experienceStartDate: "2021",
          experienceEndDate: "2024"
        }
      })
    ]);

    expect(decisions).toEqual([
      expect.objectContaining({ claimId: "experience-1", status: "needs_review", conflictSeverity: "high" }),
      expect.objectContaining({ claimId: "experience-2", status: "needs_review", conflictSeverity: "high" })
    ]);
  });

  it("records confirm and reject review transitions through the repository port", async () => {
    const repository = new RecordingTrustedClaimRepository();

    await createConfirmClaimUseCase(repository).execute({ claimId: "claim-1" });
    await createRejectClaimUseCase(repository).execute({ claimId: "claim-2", reason: "Contradicted by source." });

    expect(repository.transitions).toEqual([
      expect.objectContaining({
        claimId: "claim-1",
        nextStatus: "confirmed",
        transitionSource: "user",
        confidenceScore: 100
      }),
      expect.objectContaining({
        claimId: "claim-2",
        nextStatus: "rejected",
        transitionSource: "user",
        confidenceScore: 0,
        reason: "Contradicted by source."
      })
    ]);
  });

  it("removes stale claim embeddings when rejecting a claim", async () => {
    const repository = new RecordingTrustedClaimRepository();
    const cleanup = { removeClaimEmbeddings: vi.fn(async () => 2) };

    const result = await createRejectClaimUseCase(repository, cleanup)
      .execute({ claimId: "claim-2", reason: "Contradicted by source." });

    expect(cleanup.removeClaimEmbeddings).toHaveBeenCalledWith("claim-2");
    expect(result).toEqual({ claimId: "claim-2", status: "rejected", removedEmbeddings: 2 });
  });

  it("rejects empty rejection reasons", async () => {
    const repository = new RecordingTrustedClaimRepository();

    await expect(createRejectClaimUseCase(repository).execute({ claimId: "claim-1", reason: "   " }))
      .rejects.toThrow("Rejecting a claim requires a non-empty reason.");
  });
});
