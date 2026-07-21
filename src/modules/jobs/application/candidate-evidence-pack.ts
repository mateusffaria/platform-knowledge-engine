import { createHash } from "node:crypto";

import { EvidencePack } from "../../retrieval/application/types.js";
import {
  CandidateEvidence,
  CandidateEvidencePack,
  CandidateSelectionConfig,
  CandidateRequirementComponentEvidence,
  CandidateRequirementEvidence,
  JobDescriptionWithRequirements
} from "../domain/model.js";
import { atomicComponentsOf, normalizeWarnings } from "../domain/atomic-job-requirement.js";
import {
  compareCandidateEvidence,
  defaultCandidateSelectionConfig,
  selectCandidatesForReasoner
} from "./candidate-evidence-selection.js";

export const candidateEvidencePackVersion = "candidate-evidence-pack-v5";

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
  const stableDiagnostics = (diagnostics: CandidateRequirementEvidence["diagnostics"]) => ({
    retrievalIntent: diagnostics.retrievalIntent,
    rawRetrievalResultCount: diagnostics.rawRetrievalResultCount,
    eligibleResultCount: diagnostics.eligibleResultCount,
    canonicalHydrationCount: diagnostics.canonicalHydrationCount,
    requirementAssociationCount: diagnostics.requirementAssociationCount,
    selectedForReasonerCount: diagnostics.selectedForReasonerCount,
    selectionExclusions: diagnostics.selectionExclusions.map((exclusion) => ({ ...exclusion })),
    discardedResults: diagnostics.discardedResults.map((discarded) => ({ ...discarded }))
  });
  return JSON.stringify({
    version: pack.version,
    jobDescriptionId: pack.jobDescriptionId,
    jobAnalysisId: pack.jobAnalysisId,
    selection: pack.selection,
    requirements: pack.requirements.map((requirement) => ({
      requirementId: requirement.requirementId,
      requirementText: requirement.requirementText,
      importance: requirement.importance,
      diagnostics: stableDiagnostics(requirement.diagnostics),
      candidates: requirement.candidates
        .filter((candidate) => requirement.reasonerCandidateIds.includes(candidate.evidenceClaimId))
        .map((candidate) => ({
          evidenceClaimId: candidate.evidenceClaimId,
          claimText: candidate.claimText,
          claimType: candidate.claimType,
          claimCategory: candidate.claimCategory,
          claimStatus: candidate.claimStatus,
          valueText: candidate.valueText,
          valueUnit: candidate.valueUnit
        })),
      components: (requirement.components ?? []).map((component) => ({
        componentId: component.componentId,
        componentIndex: component.componentIndex,
        componentText: component.componentText,
        diagnostics: stableDiagnostics(component.diagnostics),
        candidates: component.candidates
          .filter((candidate) => component.reasonerCandidateIds.includes(candidate.evidenceClaimId))
          .map((candidate) => ({
            evidenceClaimId: candidate.evidenceClaimId,
            claimText: candidate.claimText,
            claimType: candidate.claimType,
            claimCategory: candidate.claimCategory,
            claimStatus: candidate.claimStatus,
            valueText: candidate.valueText,
            valueUnit: candidate.valueUnit
          }))
      })).sort((left, right) => left.componentIndex - right.componentIndex || left.componentId.localeCompare(right.componentId))
    })).sort((left, right) => left.requirementId.localeCompare(right.requirementId)),
    diagnostics: pack.diagnostics,
    warnings: normalizeWarnings(pack.warningDiagnostics ?? pack.warnings)
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
  selection?: CandidateSelectionConfig;
  warningDiagnostics?: Array<{ code: string; message: string }>;
}): CandidateEvidencePack {
  const selection = input.selection ?? defaultCandidateSelectionConfig;
  const candidates = input.evidencePack.items.flatMap((item) => {
    const candidate = toCandidateEvidence(item);
    return candidate ? [candidate] : [];
  }).sort(compareCandidateEvidence);
  const assetOnly = input.evidencePack.items.filter((item) => !item.evidenceClaimId);
  const cloneCandidate = (candidate: CandidateEvidence): CandidateEvidence => ({
    ...candidate,
    sources: candidate.sources.map((source) => ({ ...source })),
    objectiveSignals: { ...candidate.objectiveSignals, retrievalStrategies: [...candidate.objectiveSignals.retrievalStrategies] }
  });
  const unselectedRequirements: CandidateRequirementEvidence[] = input.preparedRequirements ?? input.jobDescription.requirements
    .filter((requirement) => !requirement.inferred)
    .map((requirement) => {
      const components: CandidateRequirementComponentEvidence[] = atomicComponentsOf(requirement).map((component) => ({
        requirementId: requirement.id,
        componentId: component.id,
        componentIndex: component.componentIndex,
        componentText: component.originalText,
        requirementType: component.requirementType,
        importance: component.importance,
        candidates: candidates.map(cloneCandidate),
        reasonerCandidateIds: [],
        diagnostics: {
          retrievalIntent: input.retrievalIntent ?? input.evidencePack.query,
          rawRetrievalResultCount: input.evidencePack.items.length,
          eligibleResultCount: candidates.length,
          canonicalHydrationCount: candidates.length,
          requirementAssociationCount: candidates.length,
          selectedForReasonerCount: 0,
          selectionExclusions: [],
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
      return {
        requirementId: requirement.id,
        requirementText: requirement.originalText,
        requirementType: requirement.requirementType,
        importance: requirement.importance,
        candidates: candidates.map(cloneCandidate),
        reasonerCandidateIds: [],
        components,
        diagnostics: {
          retrievalIntent: input.retrievalIntent ?? input.evidencePack.query,
          rawRetrievalResultCount: input.evidencePack.items.length,
          eligibleResultCount: candidates.length,
          canonicalHydrationCount: candidates.length,
          requirementAssociationCount: candidates.length,
          selectedForReasonerCount: 0,
          selectionExclusions: [],
          discardedResults: components.flatMap((component) => component.diagnostics.discardedResults)
        }
      };
    });
  const requirements = unselectedRequirements.map((requirement) => {
    const sourceRequirement = input.jobDescription.requirements.find((candidate) => candidate.id === requirement.requirementId);
    const unselectedComponents = requirement.components && requirement.components.length > 0
      ? requirement.components
      : atomicComponentsOf(sourceRequirement ?? {
        id: requirement.requirementId,
        jobDescriptionId: input.jobDescription.job.id,
        requirementType: requirement.requirementType,
        importance: requirement.importance,
        originalText: requirement.requirementText,
        sourceExcerpt: requirement.requirementText,
        sourceLocation: { startLine: 0, endLine: 0 },
        inferred: false
      }).map((component): CandidateRequirementComponentEvidence => ({
        requirementId: requirement.requirementId,
        componentId: component.id,
        componentIndex: component.componentIndex,
        componentText: component.originalText,
        requirementType: component.requirementType,
        importance: component.importance,
        candidates: requirement.candidates.map(cloneCandidate),
        reasonerCandidateIds: [],
        diagnostics: { ...requirement.diagnostics, selectionExclusions: [...requirement.diagnostics.selectionExclusions], discardedResults: [...requirement.diagnostics.discardedResults] }
      }));
    const componentGroups = unselectedComponents.map((component) => {
      const rankedCandidates = [...component.candidates].sort(compareCandidateEvidence);
      const selected = selectCandidatesForReasoner(rankedCandidates, selection);
      return {
        ...component,
        candidates: rankedCandidates,
        reasonerCandidateIds: selected.reasonerCandidateIds,
        diagnostics: {
          ...component.diagnostics,
          selectedForReasonerCount: selected.reasonerCandidateIds.length,
          selectionExclusions: selected.selectionExclusions
        }
      };
    });
    const rankedCandidates = [...requirement.candidates].sort(compareCandidateEvidence);
    const reasonerCandidateIds = [...new Set(componentGroups.flatMap((component) => component.reasonerCandidateIds))];
    return {
      ...requirement,
      candidates: rankedCandidates,
      reasonerCandidateIds,
      components: componentGroups,
      diagnostics: {
        ...requirement.diagnostics,
        selectedForReasonerCount: reasonerCandidateIds.length,
        selectionExclusions: componentGroups.flatMap((component) => component.diagnostics.selectionExclusions)
      }
    };
  });
  const warnings = [...input.evidencePack.warnings];
  if (assetOnly.length > 0) {
    warnings.push(`${assetOnly.length} retrieval result(s) without canonical evidence-claim identities were excluded from evidence reasoning.`);
  }
  const structuredWarnings = input.warningDiagnostics ?? input.evidencePack.warningDiagnostics;
  const warningDiagnostics = normalizeWarnings(structuredWarnings && structuredWarnings.length > 0 ? structuredWarnings : warnings, "candidate_evidence_pack");
  const diagnostics = {
    parentRequirementCount: requirements.length,
    atomicComponentCount: requirements.reduce((total, requirement) => total + (requirement.components?.length ?? 0), 0),
    selectedEvidencePerComponent: requirements.flatMap((requirement) => (requirement.components ?? []).map((component) => ({
      requirementId: requirement.requirementId,
      componentId: component.componentId,
      count: component.reasonerCandidateIds.length
    })))
  };
  const hashInput = {
    version: candidateEvidencePackVersion,
    jobDescriptionId: input.jobDescription.job.id,
    jobAnalysisId: input.jobAnalysisId,
    selection,
    requirements,
    warnings: warningDiagnostics.map((warning) => warning.message),
    warningDiagnostics,
    diagnostics
  };

  return {
    ...hashInput,
    hash: hashCandidateEvidencePack(hashInput),
    generatedAt: new Date()
  };
}
