import { isClaimIndexableStatus } from "../../../reconciliation/domain/eligibility.js";
import { CanonicalEvidenceReader } from "../../../retrieval/application/ports/canonical-evidence-reader.js";
import { EvidenceItem, EvidencePack, HybridSearchCandidate } from "../../../retrieval/application/types.js";
import { buildCandidateEvidencePack, toCandidateEvidence } from "../candidate-evidence-pack.js";
import { RequirementCandidatePreparation, RequirementEvidenceRetriever } from "../ports/requirement-candidate-preparation.js";
import {
  CandidateEvidence,
  CandidateRequirementEvidence,
  JobDescriptionWithRequirements
} from "../../domain/model.js";

function requirementQuery(requirement: JobDescriptionWithRequirements["requirements"][number]): string {
  const filter = requirement.normalizedValue && (requirement.requirementType === "skill" || requirement.requirementType === "technology")
    ? `${requirement.requirementType === "skill" ? "skill" : "technology"}:"${requirement.normalizedValue.replace(/"/g, "\\\"")}" `
    : "";
  return `${filter}${requirement.originalText}`.trim();
}

function evidenceItemFromCanonical(
  candidate: HybridSearchCandidate,
  retrieved: EvidencePack
): EvidenceItem {
  const prior = retrieved.items.find((item) => item.evidenceClaimId === candidate.evidenceClaimId);
  const finalScore = prior?.finalScore ?? Math.max(candidate.semanticScore ?? 0, candidate.structuredScore ?? 0);
  return {
    evidenceClaimId: candidate.evidenceClaimId,
    knowledgeAssetId: candidate.knowledgeAssetId,
    subjectAssetId: candidate.subjectAssetId,
    subjectType: candidate.subjectType,
    claimType: candidate.claimType,
    claimCategory: candidate.claimCategory,
    predicate: candidate.predicate,
    claimText: candidate.claimText,
    relatedAssetId: candidate.relatedAssetId,
    valueText: candidate.valueText,
    valueUnit: candidate.valueUnit,
    claimStatus: candidate.claimStatus,
    confidenceScore: candidate.confidenceScore,
    semanticScore: candidate.semanticScore,
    structuredScore: candidate.structuredScore,
    finalScore,
    sources: candidate.sources,
    retrievalStrategies: candidate.retrievalStrategies
  };
}

async function prepareRequirement(input: {
  requirement: JobDescriptionWithRequirements["requirements"][number];
  retriever: RequirementEvidenceRetriever;
  canonicalEvidenceReader: CanonicalEvidenceReader;
}): Promise<CandidateRequirementEvidence> {
  const retrievalIntent = requirementQuery(input.requirement);
  const retrieved = await input.retriever.execute({
    requirementId: input.requirement.id,
    query: retrievalIntent
  });
  if (retrieved.requirementId !== undefined && retrieved.requirementId !== input.requirement.id) {
    throw new Error(`Retrieval result requirement identity ${retrieved.requirementId} does not match ${input.requirement.id}.`);
  }
  const rawResults = retrieved.diagnostics.rawResults;
  const candidates: CandidateEvidence[] = [];
  const discardedResults: CandidateRequirementEvidence["diagnostics"]["discardedResults"] = [];
  const associatedClaimIds = new Set<string>();

  for (const raw of rawResults) {
    const hydrated = await input.canonicalEvidenceReader.read({
      evidenceClaimId: raw.evidenceClaimId,
      knowledgeAssetId: raw.knowledgeAssetId,
      retrievalStrategies: raw.retrievalStrategies,
      semanticScore: raw.semanticScore,
      structuredScore: raw.structuredScore
    });
    if (hydrated.kind === "discarded") {
      discardedResults.push({
        stage: "hydration",
        reasonCode: hydrated.reasonCode,
        reason: hydrated.reason,
        evidenceClaimId: raw.evidenceClaimId,
        knowledgeAssetId: raw.knowledgeAssetId,
        retrievalStrategies: [...raw.retrievalStrategies],
        semanticScore: raw.semanticScore,
        structuredScore: raw.structuredScore
      });
      continue;
    }

    if (hydrated.candidates.length === 0) {
      throw new Error(`Canonical hydration returned no terminal candidate or diagnostic for retrieval asset ${raw.knowledgeAssetId}.`);
    }

    for (const canonical of hydrated.candidates) {
      if (!canonical.claimStatus || !isClaimIndexableStatus(canonical.claimStatus)) {
        discardedResults.push({
          stage: "eligibility",
          reasonCode: "ineligible_claim_status",
          reason: canonical.claimStatus
            ? `Canonical claim status ${canonical.claimStatus} is not eligible for trusted evidence.`
            : "Canonical claim status is unavailable.",
          evidenceClaimId: canonical.evidenceClaimId,
          knowledgeAssetId: canonical.knowledgeAssetId,
          retrievalStrategies: [...canonical.retrievalStrategies],
          semanticScore: canonical.semanticScore,
          structuredScore: canonical.structuredScore
        });
        continue;
      }
      if (!canonical.evidenceClaimId || associatedClaimIds.has(canonical.evidenceClaimId)) {
        discardedResults.push({
          stage: "association",
          reasonCode: "duplicate_requirement_candidate",
          reason: "This canonical claim was already associated with the requirement through another retrieval strategy.",
          evidenceClaimId: canonical.evidenceClaimId,
          knowledgeAssetId: canonical.knowledgeAssetId,
          retrievalStrategies: [...canonical.retrievalStrategies],
          semanticScore: canonical.semanticScore,
          structuredScore: canonical.structuredScore
        });
        continue;
      }
      const evidence = toCandidateEvidence(evidenceItemFromCanonical(canonical, retrieved));
      if (!evidence) {
        throw new Error(`Canonical hydration returned claim ${canonical.evidenceClaimId ?? "without identity"} that cannot be associated.`);
      }
      associatedClaimIds.add(evidence.evidenceClaimId);
      candidates.push(evidence);
    }
  }

  for (const raw of rawResults) {
    const hasTerminalOutcome = discardedResults.some((discarded) => (
      discarded.evidenceClaimId === raw.evidenceClaimId
      || (!raw.evidenceClaimId && discarded.knowledgeAssetId === raw.knowledgeAssetId)
    )) || candidates.some((candidate) => (
      candidate.evidenceClaimId === raw.evidenceClaimId
      || (!raw.evidenceClaimId && candidate.knowledgeAssetId === raw.knowledgeAssetId)
    ));
    if (!hasTerminalOutcome) {
      throw new Error(`Raw retrieval result ${raw.evidenceClaimId ?? raw.knowledgeAssetId} has no terminal candidate-pipeline outcome.`);
    }
  }

  const duplicateAssociationCount = discardedResults.filter((item) => item.reasonCode === "duplicate_requirement_candidate").length;
  const ineligibleCanonicalCount = discardedResults.filter((item) => item.reasonCode === "ineligible_claim_status").length;

  return {
    requirementId: input.requirement.id,
    requirementText: input.requirement.originalText,
    requirementType: input.requirement.requirementType,
    importance: input.requirement.importance,
    candidates: candidates.sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId)),
    diagnostics: {
      retrievalIntent,
      rawRetrievalResultCount: rawResults.length,
      eligibleResultCount: candidates.length + duplicateAssociationCount,
      canonicalHydrationCount: candidates.length + duplicateAssociationCount + ineligibleCanonicalCount,
      requirementAssociationCount: candidates.length,
      discardedResults
    }
  };
}

export function createPrepareCandidateEvidenceUseCase(): RequirementCandidatePreparation {
  return {
    async prepare(input) {
      const requirements = input.jobDescription.requirements
        .filter((requirement) => !requirement.inferred)
        .sort((left, right) => left.id.localeCompare(right.id));
      const preparedRequirements = await Promise.all(requirements.map((requirement) => prepareRequirement({
        requirement,
        retriever: input.retriever,
        canonicalEvidenceReader: input.canonicalEvidenceReader
      })));
      const representativeEvidencePack: EvidencePack = {
        query: "requirement-scoped candidate preparation",
        strategies: [],
        items: [],
        diagnostics: {
          rawStructuredResultCount: 0,
          rawSemanticResultCount: 0,
          rawResults: [],
          eligibleResults: [],
          discardedResults: []
        },
        generatedAt: new Date(),
        warnings: [...(input.warnings ?? [])]
      };
      return buildCandidateEvidencePack({
        jobDescription: input.jobDescription,
        jobAnalysisId: input.jobAnalysisId,
        evidencePack: representativeEvidencePack,
        preparedRequirements
      });
    }
  };
}
