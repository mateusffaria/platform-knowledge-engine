import { createHash } from "node:crypto";

import { EvidencePack } from "../../retrieval/application/types.js";
import {
  CandidateEvidence,
  CandidateEvidencePack,
  CandidateRequirementEvidence,
  JobDescriptionWithRequirements
} from "../domain/model.js";

export const candidateEvidencePackVersion = "candidate-evidence-pack-v2";

export function toCandidateEvidence(item: EvidencePack["items"][number]): CandidateEvidence | undefined {
  if (!item.evidenceClaimId) {
    return undefined;
  }

  return {
    evidenceClaimId: item.evidenceClaimId,
    knowledgeAssetId: item.knowledgeAssetId,
    subjectAssetId: item.subjectAssetId,
    subjectType: item.subjectType,
    claimType: item.claimType,
    claimCategory: item.claimCategory,
    predicate: item.predicate,
    claimText: item.claimText,
    relatedAssetId: item.relatedAssetId,
    valueText: item.valueText,
    valueUnit: item.valueUnit,
    claimStatus: item.claimStatus,
    sources: item.sources.map((source) => ({
      sourceDocumentId: source.sourceDocumentId,
      sourceReferenceId: source.id,
      locator: source.locator,
      excerpt: source.excerpt,
      sourcePath: source.sourcePath,
      sourceLanguage: source.sourceLanguage,
      originalSectionLabel: source.originalSectionLabel
    })),
    objectiveSignals: {
      confidenceScore: item.confidenceScore,
      finalScore: item.finalScore,
      semanticScore: item.semanticScore,
      structuredScore: item.structuredScore,
      retrievalStrategies: [...item.retrievalStrategies]
    }
  };
}

function stablePackContent(pack: Omit<CandidateEvidencePack, "hash" | "generatedAt">): string {
  return JSON.stringify({
    ...pack,
    requirements: pack.requirements.map((requirement) => ({
      ...requirement,
      candidates: [...requirement.candidates].sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId))
    })).sort((left, right) => left.requirementId.localeCompare(right.requirementId)),
    warnings: [...pack.warnings].sort()
  });
}

export function hashCandidateEvidencePack(pack: Omit<CandidateEvidencePack, "hash" | "generatedAt">): string {
  return createHash("sha256").update(stablePackContent(pack)).digest("hex");
}

export function buildCandidateEvidencePack(input: {
  jobDescription: JobDescriptionWithRequirements;
  jobAnalysisId?: string;
  evidencePack: EvidencePack;
  retrievalIntent?: string;
  preparedRequirements?: CandidateRequirementEvidence[];
}): CandidateEvidencePack {
  const candidates = input.evidencePack.items.flatMap((item) => {
    const candidate = toCandidateEvidence(item);
    return candidate ? [candidate] : [];
  }).sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId));
  const assetOnly = input.evidencePack.items.filter((item) => !item.evidenceClaimId);
  const requirements: CandidateRequirementEvidence[] = input.preparedRequirements ?? input.jobDescription.requirements
    .filter((requirement) => !requirement.inferred)
    .map((requirement) => ({
      requirementId: requirement.id,
      requirementText: requirement.originalText,
      requirementType: requirement.requirementType,
      importance: requirement.importance,
      candidates: candidates.map((candidate) => ({ ...candidate, sources: candidate.sources.map((source) => ({ ...source })), objectiveSignals: { ...candidate.objectiveSignals, retrievalStrategies: [...candidate.objectiveSignals.retrievalStrategies] } })),
      diagnostics: {
        retrievalIntent: input.retrievalIntent ?? input.evidencePack.query,
        rawRetrievalResultCount: input.evidencePack.items.length,
        eligibleResultCount: candidates.length,
        canonicalHydrationCount: candidates.length,
        requirementAssociationCount: candidates.length,
        discardedResults: assetOnly.map((item) => ({
          stage: "hydration" as const,
          reasonCode: "asset_only_retrieval_result" as const,
          reason: "Retrieval result has no canonical evidenceClaimId and cannot be used by the Evidence Reasoner.",
          knowledgeAssetId: item.knowledgeAssetId,
          retrievalStrategies: [...item.retrievalStrategies],
          finalScore: item.finalScore
        }))
      }
    }));
  const warnings = [...input.evidencePack.warnings];
  if (assetOnly.length > 0) {
    warnings.push(`${assetOnly.length} retrieval result(s) without canonical evidence-claim identities were excluded from evidence reasoning.`);
  }
  const hashInput = {
    version: candidateEvidencePackVersion,
    jobDescriptionId: input.jobDescription.job.id,
    jobAnalysisId: input.jobAnalysisId,
    requirements,
    warnings
  };

  return {
    ...hashInput,
    hash: hashCandidateEvidencePack(hashInput),
    generatedAt: new Date()
  };
}
