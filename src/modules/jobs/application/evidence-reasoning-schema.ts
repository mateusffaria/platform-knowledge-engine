import { z } from "zod";

import {
  CandidateEvidence,
  CandidateEvidencePack,
  CoverageStatus,
  EvidenceRejection,
  EvidenceSelection,
  RequirementCoverage
} from "../domain/model.js";
import { missingCoverage } from "./evidence-curation.js";

const coverageStatusSchema = z.enum(["strong", "partial", "weak", "missing"]);
const selectionSchema = z.object({
  evidenceClaimId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  contribution: z.string().trim().min(1),
  complementaryEvidenceIds: z.array(z.string().trim().min(1)).optional(),
  exaggerationRisk: z.enum(["low", "medium", "high"])
}).strict();
const rejectionSchema = z.object({
  evidenceClaimId: z.string().trim().min(1),
  // Some local models use the coverage word "missing" for an otherwise valid
  // scope rejection. It is normalized before the domain result is created.
  reason: z.enum(["irrelevant", "weak", "redundant", "unsupported_scope", "lower_quality_alternative", "insufficient_provenance", "missing"]),
  explanation: z.string().trim().min(1)
}).strict();
const coverageSchema = z.object({
  requirementId: z.string().trim().min(1),
  coverageStatus: coverageStatusSchema,
  selections: z.array(selectionSchema),
  rejections: z.array(rejectionSchema),
  strengthFactors: z.array(z.string().trim().min(1)),
  limitations: z.array(z.string().trim().min(1)),
  explanation: z.string().trim().min(1)
}).strict();

export const evidenceReasoningOutputSchema = z.object({
  overallCoverageSummary: z.string().trim().min(1),
  warnings: z.array(z.string().trim().min(1)),
  limitations: z.array(z.string().trim().min(1)),
  coverage: z.array(coverageSchema)
}).strict();

type EvidenceReasoningOutput = z.infer<typeof evidenceReasoningOutputSchema>;

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Evidence reasoner returned duplicate ${label}.`);
  }
}

function candidateById(candidates: CandidateEvidence[], id: string): CandidateEvidence {
  const candidate = candidates.find((value) => value.evidenceClaimId === id);
  if (!candidate) {
    throw new Error(`Evidence reasoner referenced an unknown or out-of-scope evidence claim: ${id}`);
  }
  return candidate;
}

function validateCoverage(output: EvidenceReasoningOutput, pack: CandidateEvidencePack): RequirementCoverage[] {
  unique(output.coverage.map((entry) => entry.requirementId), "requirement coverage entries");
  const coverageByRequirement = new Map(output.coverage.map((entry) => [entry.requirementId, entry]));
  const result: RequirementCoverage[] = [];

  for (const requirement of pack.requirements) {
    const draft = coverageByRequirement.get(requirement.requirementId);
    if (!draft) {
      if (requirement.candidates.length === 0) {
        result.push(missingCoverage(requirement));
        continue;
      }
      throw new Error(`Evidence reasoner omitted requirement coverage: ${requirement.requirementId}`);
    }
    const selectedIds = draft.selections.map((selection) => selection.evidenceClaimId);
    const rejectedIds = draft.rejections.map((rejection) => rejection.evidenceClaimId);
    unique(selectedIds, `selected evidence for ${requirement.requirementId}`);
    unique(rejectedIds, `rejected evidence for ${requirement.requirementId}`);
    if (selectedIds.some((id) => rejectedIds.includes(id))) {
      throw new Error(`Evidence reasoner both selected and rejected the same evidence for ${requirement.requirementId}.`);
    }
    if (draft.coverageStatus === "missing" && selectedIds.length > 0) {
      throw new Error(`Evidence reasoner selected evidence for missing coverage: ${requirement.requirementId}`);
    }
    const selections: EvidenceSelection[] = draft.selections.map((selection) => {
      const complementaryEvidenceIds = selection.complementaryEvidenceIds ?? [];
      unique(complementaryEvidenceIds, `complementary evidence for ${requirement.requirementId}`);
      if (complementaryEvidenceIds.some((id) => !selectedIds.includes(id) || id === selection.evidenceClaimId)) {
        throw new Error(`Evidence reasoner referenced non-selected complementary evidence for ${requirement.requirementId}.`);
      }
      return { ...selection, complementaryEvidenceIds: complementaryEvidenceIds.length ? complementaryEvidenceIds : undefined, evidence: candidateById(requirement.candidates, selection.evidenceClaimId) };
    });
    const rejections: EvidenceRejection[] = draft.rejections.map((rejection) => ({
      evidenceClaimId: rejection.evidenceClaimId,
      reason: rejection.reason === "missing" ? "unsupported_scope" : rejection.reason,
      explanation: rejection.explanation,
      evidence: candidateById(requirement.candidates, rejection.evidenceClaimId)
    }));
    const onlySkillSelection = selections.length === 1 && selections[0].evidence.claimType === "skill";
    if (draft.coverageStatus === "strong" && onlySkillSelection) {
      throw new Error(`Evidence reasoner marked isolated skill-only evidence as strong coverage for ${requirement.requirementId}.`);
    }
    result.push({
      requirementId: requirement.requirementId,
      requirementText: requirement.requirementText,
      importance: requirement.importance,
      coverageStatus: draft.coverageStatus as CoverageStatus,
      selectedEvidenceIds: selectedIds,
      rejectedCandidateEvidenceIds: rejectedIds,
      selections,
      rejections,
      strengthFactors: draft.strengthFactors,
      limitations: draft.limitations,
      explanation: draft.explanation
    });
  }
  for (const requirementId of coverageByRequirement.keys()) {
    if (!pack.requirements.some((requirement) => requirement.requirementId === requirementId)) {
      throw new Error(`Evidence reasoner referenced an unknown requirement: ${requirementId}`);
    }
  }
  return result;
}

export function parseEvidenceReasoningOutput(content: string, pack: CandidateEvidencePack): Omit<EvidenceReasoningOutput, "coverage"> & { coverage: RequirementCoverage[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Evidence Reasoner returned output that was not valid JSON.", { cause: error });
  }
  // Ollama models sometimes mirror known prompt-envelope fields. Strip only
  // those fields because the application never reads them from the response;
  // the schema remains strict for every other key and every nested decision.
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const {
      contractVersion: _contractVersion,
      jobDescriptionId: _jobDescriptionId,
      jobAnalysisId: _jobAnalysisId,
      candidatePack: _candidatePack,
      requirements: _requirements,
      responseShape: _responseShape,
      ...reasoningOutput
    } = parsed as Record<string, unknown>;
    parsed = reasoningOutput;
  }
  const output = evidenceReasoningOutputSchema.safeParse(parsed);
  if (!output.success) {
    throw new Error(`Evidence Reasoner returned invalid structured output: ${output.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return { ...output.data, coverage: validateCoverage(output.data, pack) };
}
