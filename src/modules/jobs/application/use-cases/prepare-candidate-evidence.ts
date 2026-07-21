import { isClaimIndexableStatus } from "../../../reconciliation/domain/eligibility.js";
import { CanonicalEvidenceReader } from "../../../retrieval/application/ports/canonical-evidence-reader.js";
import { EvidenceItem, EvidencePack, HybridSearchCandidate, RetrievalStrategy } from "../../../retrieval/application/types.js";
import { buildCandidateEvidencePack, toCandidateEvidence } from "../candidate-evidence-pack.js";
import { RequirementCandidatePreparation, RequirementEvidenceRetriever } from "../ports/requirement-candidate-preparation.js";
import {
  AtomicJobRequirement,
  CandidateEvidence,
  CandidateRequirementComponentEvidence,
  CandidateRequirementEvidence,
  JobDescriptionWithRequirements
} from "../../domain/model.js";
import { atomicComponentsOf, normalizeWarnings } from "../../domain/atomic-job-requirement.js";

function componentQuery(component: AtomicJobRequirement): string {
  const filter = component.normalizedValue && (component.requirementType === "skill" || component.requirementType === "technology")
    ? `${component.requirementType === "skill" ? "skill" : "technology"}:"${component.normalizedValue.replace(/"/g, "\\\"")}" `
    : "";
  return `${filter}${component.originalText}`.trim();
}

function evidenceItemFromCanonical(
  candidate: HybridSearchCandidate
): EvidenceItem {
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
    finalScore: candidate.finalScore ?? 0,
    sources: candidate.sources,
    retrievalStrategies: candidate.retrievalStrategies
  };
}

function mergeStrategies(left: RetrievalStrategy[], right: RetrievalStrategy[]): RetrievalStrategy[] {
  return (["structured", "semantic"] as const).filter((strategy) => left.includes(strategy) || right.includes(strategy));
}

function mergeCandidateEvidence(current: CandidateEvidence, next: CandidateEvidence): CandidateEvidence {
  const preferred = next.objectiveSignals.finalScore > current.objectiveSignals.finalScore ? next : current;
  const other = preferred === next ? current : next;
  return {
    ...preferred,
    sources: [...preferred.sources, ...other.sources.filter((source) => !preferred.sources.some((existing) => (
      existing.sourceDocumentId === source.sourceDocumentId && existing.sourceReferenceId === source.sourceReferenceId
    )))],
    objectiveSignals: {
      ...preferred.objectiveSignals,
      retrievalStrategies: mergeStrategies(
        preferred.objectiveSignals.retrievalStrategies as RetrievalStrategy[],
        other.objectiveSignals.retrievalStrategies as RetrievalStrategy[]
      )
    }
  };
}

function discardKey(discarded: CandidateRequirementEvidence["diagnostics"]["discardedResults"][number]): string {
  return [discarded.stage, discarded.reasonCode, discarded.evidenceClaimId ?? "", discarded.knowledgeAssetId ?? ""].join("|");
}

function mergeDiscard(
  current: CandidateRequirementEvidence["diagnostics"]["discardedResults"][number],
  next: CandidateRequirementEvidence["diagnostics"]["discardedResults"][number]
): CandidateRequirementEvidence["diagnostics"]["discardedResults"][number] {
  const currentScore = current.finalScore ?? Number.NEGATIVE_INFINITY;
  const nextScore = next.finalScore ?? Number.NEGATIVE_INFINITY;
  const preferred = nextScore > currentScore ? next : current;
  const other = preferred === next ? current : next;
  return {
    ...preferred,
    retrievalStrategies: mergeStrategies(
      (preferred.retrievalStrategies ?? []) as RetrievalStrategy[],
      (other.retrievalStrategies ?? []) as RetrievalStrategy[]
    )
  };
}

async function prepareComponent(input: {
  requirement: JobDescriptionWithRequirements["requirements"][number];
  component: AtomicJobRequirement;
  retriever: RequirementEvidenceRetriever;
  canonicalEvidenceReader: CanonicalEvidenceReader;
}): Promise<CandidateRequirementComponentEvidence> {
  const retrievalIntent = componentQuery(input.component);
  const retrieved = await input.retriever.execute({
    requirementId: input.requirement.id,
    componentId: input.component.id,
    query: retrievalIntent
  });
  if (retrieved.requirementId !== undefined && retrieved.requirementId !== input.requirement.id && retrieved.requirementId !== input.component.id) {
    throw new Error(`Retrieval result requirement identity ${retrieved.requirementId} does not match parent ${input.requirement.id} or component ${input.component.id}.`);
  }
  const rawResults = retrieved.diagnostics.rawResults;
  const associatedCandidates = new Map<string, CandidateEvidence>();
  const discards = new Map<string, CandidateRequirementEvidence["diagnostics"]["discardedResults"][number]>();
  let canonicalHydrationCount = 0;
  let eligibleResultCount = 0;
  const recordDiscard = (discarded: CandidateRequirementEvidence["diagnostics"]["discardedResults"][number]): void => {
    const key = discardKey(discarded);
    const existing = discards.get(key);
    discards.set(key, existing ? mergeDiscard(existing, discarded) : discarded);
  };

  for (const raw of rawResults) {
    const hydrated = await input.canonicalEvidenceReader.read({
      evidenceClaimId: raw.evidenceClaimId,
      knowledgeAssetId: raw.knowledgeAssetId,
      retrievalStrategies: raw.retrievalStrategies,
      finalScore: raw.finalScore,
      semanticScore: raw.semanticScore,
      structuredScore: raw.structuredScore
    });
    if (hydrated.kind === "discarded") {
      recordDiscard({
        stage: "hydration",
        reasonCode: hydrated.reasonCode,
        reason: hydrated.reason,
        evidenceClaimId: raw.evidenceClaimId,
        knowledgeAssetId: raw.knowledgeAssetId,
        retrievalStrategies: [...raw.retrievalStrategies],
        finalScore: raw.finalScore,
        semanticScore: raw.semanticScore,
        structuredScore: raw.structuredScore
      });
      continue;
    }

    if (hydrated.candidates.length === 0) {
      throw new Error(`Canonical hydration returned no terminal candidate or diagnostic for retrieval asset ${raw.knowledgeAssetId}.`);
    }

    canonicalHydrationCount += hydrated.candidates.length;

    for (const canonical of hydrated.candidates) {
      if (!canonical.claimStatus || !isClaimIndexableStatus(canonical.claimStatus)) {
        recordDiscard({
          stage: "eligibility",
          reasonCode: "ineligible_claim_status",
          reason: canonical.claimStatus
            ? `Canonical claim status ${canonical.claimStatus} is not eligible for trusted evidence.`
            : "Canonical claim status is unavailable.",
          evidenceClaimId: canonical.evidenceClaimId,
          knowledgeAssetId: canonical.knowledgeAssetId,
          retrievalStrategies: [...canonical.retrievalStrategies],
          finalScore: canonical.finalScore,
          semanticScore: canonical.semanticScore,
          structuredScore: canonical.structuredScore
        });
        continue;
      }
      eligibleResultCount += 1;
      if (!canonical.evidenceClaimId) {
        recordDiscard({
          stage: "association",
          reasonCode: "duplicate_requirement_candidate",
          reason: "This canonical claim was already associated with the requirement through another retrieval strategy.",
          evidenceClaimId: canonical.evidenceClaimId,
          knowledgeAssetId: canonical.knowledgeAssetId,
          retrievalStrategies: [...canonical.retrievalStrategies],
          finalScore: canonical.finalScore,
          semanticScore: canonical.semanticScore,
          structuredScore: canonical.structuredScore
        });
        continue;
      }
      const evidence = toCandidateEvidence(evidenceItemFromCanonical(canonical));
      if (!evidence) {
        throw new Error(`Canonical hydration returned claim ${canonical.evidenceClaimId ?? "without identity"} that cannot be associated.`);
      }
      const existing = associatedCandidates.get(evidence.evidenceClaimId);
      if (existing) {
        const mergedEvidence = mergeCandidateEvidence(existing, evidence);
        recordDiscard({
          stage: "association",
          reasonCode: "duplicate_requirement_candidate",
          reason: "This canonical claim was already associated with the requirement through another retrieval strategy.",
          evidenceClaimId: evidence.evidenceClaimId,
          knowledgeAssetId: evidence.knowledgeAssetId,
          retrievalStrategies: [...mergedEvidence.objectiveSignals.retrievalStrategies],
          semanticScore: mergedEvidence.objectiveSignals.semanticScore,
          structuredScore: mergedEvidence.objectiveSignals.structuredScore,
          finalScore: mergedEvidence.objectiveSignals.finalScore
        });
        associatedCandidates.set(evidence.evidenceClaimId, mergedEvidence);
        continue;
      }
      associatedCandidates.set(evidence.evidenceClaimId, evidence);
    }
  }

  const candidates = Array.from(associatedCandidates.values());
  const discardedResults = Array.from(discards.values());

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

  return {
    requirementId: input.requirement.id,
    componentId: input.component.id,
    componentIndex: input.component.componentIndex,
    componentText: input.component.originalText,
    requirementType: input.component.requirementType,
    importance: input.requirement.importance,
    candidates,
    reasonerCandidateIds: [],
    warnings: [...retrieved.warnings],
    warningDiagnostics: retrieved.warningDiagnostics?.map((warning) => ({ ...warning })),
    diagnostics: {
      retrievalIntent,
      rawRetrievalResultCount: rawResults.length,
      eligibleResultCount,
      canonicalHydrationCount,
      requirementAssociationCount: candidates.length,
      selectedForReasonerCount: 0,
      selectionExclusions: [],
      discardedResults
    }
  };
}

function aggregatePreparedRequirement(
  requirement: JobDescriptionWithRequirements["requirements"][number],
  components: CandidateRequirementComponentEvidence[]
): CandidateRequirementEvidence {
  const candidates = new Map<string, CandidateEvidence>();
  for (const component of components) {
    for (const candidate of component.candidates) {
      const existing = candidates.get(candidate.evidenceClaimId);
      candidates.set(candidate.evidenceClaimId, existing ? mergeCandidateEvidence(existing, candidate) : candidate);
    }
  }
  const associated = [...candidates.values()];
  return {
    requirementId: requirement.id,
    requirementText: requirement.originalText,
    requirementType: requirement.requirementType,
    importance: requirement.importance,
    candidates: associated,
    reasonerCandidateIds: [],
    components,
    diagnostics: {
      retrievalIntent: components.map((component) => component.diagnostics.retrievalIntent).join(" | "),
      rawRetrievalResultCount: components.reduce((total, component) => total + component.diagnostics.rawRetrievalResultCount, 0),
      eligibleResultCount: components.reduce((total, component) => total + component.diagnostics.eligibleResultCount, 0),
      canonicalHydrationCount: components.reduce((total, component) => total + component.diagnostics.canonicalHydrationCount, 0),
      requirementAssociationCount: associated.length,
      selectedForReasonerCount: 0,
      selectionExclusions: [],
      discardedResults: components.flatMap((component) => component.diagnostics.discardedResults)
    }
  };
}

export function createPrepareCandidateEvidenceUseCase(): RequirementCandidatePreparation {
  return {
    async prepare(input) {
      const requirements = input.jobDescription.requirements
        .filter((requirement) => !requirement.inferred)
        .sort((left, right) => left.id.localeCompare(right.id));
      const preparedRequirements = await Promise.all(requirements.map(async (requirement) => aggregatePreparedRequirement(
        requirement,
        await Promise.all(atomicComponentsOf(requirement).map((component) => prepareComponent({
          requirement,
          component,
          retriever: input.retriever,
          canonicalEvidenceReader: input.canonicalEvidenceReader
        })))
      )));
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
        warnings: [
          ...(input.warnings ?? []),
          ...preparedRequirements.flatMap((requirement) => (requirement.components ?? []).flatMap((component) => component.warnings ?? []))
        ],
        warningDiagnostics: normalizeWarnings([
          ...(input.warningDiagnostics ?? normalizeWarnings(input.warnings ?? [], "job_retrieval_intent")),
          ...preparedRequirements.flatMap((requirement) => (requirement.components ?? []).flatMap((component) => (
            component.warningDiagnostics ?? normalizeWarnings(component.warnings ?? [], "candidate_evidence_pack")
          )))
        ])
      };
      return buildCandidateEvidencePack({
        jobDescription: input.jobDescription,
        jobAnalysisId: input.jobAnalysisId,
        evidencePack: representativeEvidencePack,
        preparedRequirements,
        selection: input.selection,
        warningDiagnostics: representativeEvidencePack.warningDiagnostics
      });
    }
  };
}
