import {
  CandidateEvidencePack,
  CoverageStatus,
  CuratedEvidencePack,
  EvidenceRejection,
  RequirementCoverage
} from "../domain/model.js";
import { aggregateParentCoverageStatus, candidateComponentsOf, normalizeWarnings } from "../domain/atomic-job-requirement.js";

const coverageRank: Record<CoverageStatus, number> = { missing: 0, weak: 1, partial: 2, strong: 3 };

export function missingCoverage(requirement: CandidateEvidencePack["requirements"][number]): RequirementCoverage {
  const componentCoverage = candidateComponentsOf(requirement).map((component) => ({
    requirementId: requirement.requirementId,
    componentId: component.componentId,
    componentIndex: component.componentIndex,
    componentText: component.componentText,
    importance: component.importance,
    coverageStatus: "missing" as const,
    selectedEvidenceIds: [],
    rejectedCandidateEvidenceIds: [],
    selections: [],
    rejections: [],
    strengthFactors: [],
    limitations: ["No eligible canonical evidence was supplied for this atomic component."],
    explanation: "No eligible canonical evidence was supplied; component coverage cannot be established."
  }));
  return {
    requirementId: requirement.requirementId,
    requirementText: requirement.requirementText,
    importance: requirement.importance,
    coverageStatus: "missing",
    selectedEvidenceIds: [],
    rejectedCandidateEvidenceIds: [],
    selections: [],
    rejections: [],
    strengthFactors: [],
    limitations: ["No eligible canonical evidence was supplied for this requirement."],
    explanation: "No eligible canonical evidence was supplied; coverage cannot be established.",
    componentCoverage
  };
}

export function aggregateRequirementCoverage(input: {
  requirementId: string;
  requirementText: string;
  importance: RequirementCoverage["importance"];
  componentCoverage: NonNullable<RequirementCoverage["componentCoverage"]>;
}): RequirementCoverage {
  const components = [...input.componentCoverage].sort((left, right) => (left.componentIndex ?? 0) - (right.componentIndex ?? 0) || left.componentId.localeCompare(right.componentId));
  const unique = (values: string[]) => [...new Set(values)].sort();
  return {
    requirementId: input.requirementId,
    requirementText: input.requirementText,
    importance: input.importance,
    coverageStatus: aggregateParentCoverageStatus(components),
    selectedEvidenceIds: unique(components.flatMap((component) => component.selectedEvidenceIds)),
    rejectedCandidateEvidenceIds: unique(components.flatMap((component) => component.rejectedCandidateEvidenceIds)),
    selections: components.flatMap((component) => component.selections),
    rejections: components.flatMap((component) => component.rejections),
    strengthFactors: unique(components.flatMap((component) => component.strengthFactors)),
    limitations: unique(components.flatMap((component) => component.limitations)),
    explanation: components.map((component) => `${component.componentText}: ${component.coverageStatus}.`).join(" "),
    componentCoverage: components
  };
}

export function displayScore(coverage: RequirementCoverage[]): number | undefined {
  if (coverage.length === 0) {
    return undefined;
  }
  const weighted = coverage.reduce((total, entry) => total + coverageRank[entry.coverageStatus] * (entry.importance === "required" ? 2 : 1), 0);
  const maximum = coverage.reduce((total, entry) => total + 3 * (entry.importance === "required" ? 2 : 1), 0);
  return Math.round((weighted / maximum) * 100);
}

function downgrade(status: CoverageStatus): CoverageStatus {
  return status === "strong" ? "partial" : status === "partial" ? "weak" : status;
}

export function deduplicateCrossRequirementSelections(coverage: RequirementCoverage[]): RequirementCoverage[] {
  const componentEntries = coverage.flatMap((parent) => (parent.componentCoverage ?? []).map((component) => ({ parent, component })));
  if (componentEntries.length > 0) {
    const firstByClaim = new Map<string, (typeof componentEntries)[number]>();
    const sortedComponents = [...componentEntries].sort((left, right) => {
      const importance = Number(right.component.importance === "required") - Number(left.component.importance === "required");
      return importance || left.parent.requirementId.localeCompare(right.parent.requirementId) || left.component.componentId.localeCompare(right.component.componentId);
    });
    for (const entry of sortedComponents) {
      for (const selection of [...entry.component.selections]) {
        const existing = firstByClaim.get(selection.evidenceClaimId);
        if (!existing) {
          firstByClaim.set(selection.evidenceClaimId, entry);
          continue;
        }
        const existingSelection = existing.component.selections.find((candidate) => candidate.evidenceClaimId === selection.evidenceClaimId);
        const distinctContribution = selection.contribution.trim().toLocaleLowerCase() !== existingSelection?.contribution.trim().toLocaleLowerCase();
        if (distinctContribution) continue;
        entry.component.selections = entry.component.selections.filter((candidate) => candidate.evidenceClaimId !== selection.evidenceClaimId);
        entry.component.selectedEvidenceIds = entry.component.selections.map((candidate) => candidate.evidenceClaimId);
        const rejection: EvidenceRejection = {
          evidenceClaimId: selection.evidenceClaimId,
          reason: "redundant",
          explanation: "This canonical claim was retained for another atomic component where it provides the preferred direct support.",
          evidence: selection.evidence,
          addressedRequirementIds: [entry.parent.requirementId],
          addressedComponentIds: [entry.component.componentId]
        };
        entry.component.rejections.push(rejection);
        entry.component.rejectedCandidateEvidenceIds = uniqueStrings([...entry.component.rejectedCandidateEvidenceIds, rejection.evidenceClaimId]);
        entry.component.limitations = uniqueStrings([...entry.component.limitations, "A redundant cross-component selection was removed."]);
        entry.component.coverageStatus = entry.component.selections.length === 0 ? "missing" : downgrade(entry.component.coverageStatus);
      }
    }
    return coverage.map((parent) => aggregateRequirementCoverage({
      requirementId: parent.requirementId,
      requirementText: parent.requirementText,
      importance: parent.importance,
      componentCoverage: parent.componentCoverage ?? []
    }));
  }

  const firstByClaim = new Map<string, RequirementCoverage>();
  const sorted = [...coverage].sort((left, right) => {
    const importance = Number(right.importance === "required") - Number(left.importance === "required");
    return importance || left.requirementId.localeCompare(right.requirementId);
  });
  for (const entry of sorted) {
    for (const selection of [...entry.selections]) {
      const existing = firstByClaim.get(selection.evidenceClaimId);
      if (!existing) {
        firstByClaim.set(selection.evidenceClaimId, entry);
        continue;
      }
      const distinctContribution = selection.contribution.trim().toLocaleLowerCase() !== existing.selections
        .find((candidate) => candidate.evidenceClaimId === selection.evidenceClaimId)?.contribution.trim().toLocaleLowerCase();
      if (distinctContribution) {
        continue;
      }
      entry.selections = entry.selections.filter((candidate) => candidate.evidenceClaimId !== selection.evidenceClaimId);
      entry.selectedEvidenceIds = entry.selections.map((candidate) => candidate.evidenceClaimId);
      const rejection: EvidenceRejection = {
        evidenceClaimId: selection.evidenceClaimId,
        reason: "redundant",
        explanation: "This canonical claim was retained for another requirement where it provides the preferred direct support.",
        evidence: selection.evidence
      };
      entry.rejections.push(rejection);
      entry.rejectedCandidateEvidenceIds = [...new Set([...entry.rejectedCandidateEvidenceIds, rejection.evidenceClaimId])];
      entry.limitations = [...entry.limitations, "A redundant cross-requirement selection was removed."];
      entry.coverageStatus = entry.selections.length === 0 ? "missing" : downgrade(entry.coverageStatus);
    }
  }
  return coverage;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function finalizeCuratedEvidencePack(pack: CuratedEvidencePack): CuratedEvidencePack {
  const requirementCoverage = deduplicateCrossRequirementSelections(pack.requirementCoverage);
  const warningDiagnostics = normalizeWarnings(pack.warningDiagnostics ?? pack.warnings, "evidence_reasoning");
  return {
    ...pack,
    requirementCoverage,
    recommendedEvidence: requirementCoverage.flatMap((entry) => entry.selections),
    discardedEvidence: requirementCoverage.flatMap((entry) => entry.rejections),
    missingEvidence: requirementCoverage.flatMap((entry) => (entry.componentCoverage ?? [])
      .filter((component) => component.coverageStatus === "missing")
      .map((component) => ({
        requirementId: entry.requirementId,
        requirementText: entry.requirementText,
        componentId: component.componentId,
        componentText: component.componentText,
        reason: component.limitations[0] ?? "No sufficient eligible evidence was selected for this atomic component."
      }))),
    warnings: warningDiagnostics.map((warning) => warning.message),
    warningDiagnostics,
    displayScore: displayScore(requirementCoverage)
  };
}
