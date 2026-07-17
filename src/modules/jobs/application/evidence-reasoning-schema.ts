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

/**
 * Kept alongside the Zod validator so the provider constrains generation with
 * the exact contract that is checked locally. Zod v3 does not expose a JSON
 * Schema serializer, so this deliberately mirrors only the provider output
 * shape (not the enriched, persisted CuratedEvidencePack).
 */
export const evidenceReasoningOutputJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["overallCoverageSummary", "warnings", "limitations", "coverage"],
  properties: {
    overallCoverageSummary: { type: "string", minLength: 1 },
    warnings: { type: "array", items: { type: "string", minLength: 1 } },
    limitations: { type: "array", items: { type: "string", minLength: 1 } },
    coverage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirementId", "coverageStatus", "selections", "rejections", "strengthFactors", "limitations", "explanation"],
        properties: {
          requirementId: { type: "string", minLength: 1 },
          coverageStatus: { type: "string", enum: ["strong", "partial", "weak", "missing"] },
          selections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["evidenceClaimId", "reason", "contribution", "exaggerationRisk"],
              properties: {
                evidenceClaimId: { type: "string", minLength: 1 },
                reason: { type: "string", minLength: 1 },
                contribution: { type: "string", minLength: 1 },
                complementaryEvidenceIds: { type: "array", items: { type: "string", minLength: 1 } },
                exaggerationRisk: { type: "string", enum: ["low", "medium", "high"] }
              }
            }
          },
          rejections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["evidenceClaimId", "reason", "explanation"],
              properties: {
                evidenceClaimId: { type: "string", minLength: 1 },
                reason: { type: "string", enum: ["irrelevant", "weak", "redundant", "unsupported_scope", "lower_quality_alternative", "insufficient_provenance", "missing"] },
                explanation: { type: "string", minLength: 1 }
              }
            }
          },
          strengthFactors: { type: "array", items: { type: "string", minLength: 1 } },
          limitations: { type: "array", items: { type: "string", minLength: 1 } },
          explanation: { type: "string", minLength: 1 }
        }
      }
    }
  }
};

type EvidenceReasoningOutput = z.infer<typeof evidenceReasoningOutputSchema>;

export interface EvidenceReasoningValidationDiagnostic {
  errorCode: "invalid_json" | "invalid_structured_output" | "invalid_reasoning_output";
  errorSummary: string;
  validationIssueCount?: number;
  validationIssues?: string;
}

function issuePath(path: (string | number)[]): string {
  if (path.length === 0) return "root";
  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(/\.\[/g, "[");
}

export function describeEvidenceReasoningValidationError(error: unknown): EvidenceReasoningValidationDiagnostic {
  if (!(error instanceof Error)) {
    return { errorCode: "invalid_reasoning_output", errorSummary: "The evidence-reasoning validation failed with a non-error value." };
  }

  if (error.message.startsWith("Evidence Reasoner returned output that was not valid JSON")) {
    return { errorCode: "invalid_json", errorSummary: "The model response was not valid JSON." };
  }

  if (error.message.startsWith("Evidence Reasoner returned invalid structured output")) {
    const issues = error.cause instanceof z.ZodError ? error.cause.issues : [];
    const issueSummary = [...new Set(issues.slice(0, 8).map((issue) => `${issuePath(issue.path)}:${issue.code}`))].join(", ");
    return {
      errorCode: "invalid_structured_output",
      errorSummary: `The model response violated ${issues.length || 1} structured-output constraint(s).`,
      validationIssueCount: issues.length || undefined,
      validationIssues: issueSummary || undefined
    };
  }

  return { errorCode: "invalid_reasoning_output", errorSummary: "The model response failed evidence-reasoning validation." };
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Evidence reasoner returned duplicate ${label}.`);
  }
}

function deduplicateRejections(
  rejections: EvidenceReasoningOutput["coverage"][number]["rejections"],
  requirementId: string,
  validationWarnings: string[]
): EvidenceReasoningOutput["coverage"][number]["rejections"] {
  const seen = new Set<string>();
  return rejections.filter((rejection) => {
    if (seen.has(rejection.evidenceClaimId)) {
      validationWarnings.push(`Evidence Reasoner repeated rejected evidence ${rejection.evidenceClaimId} for requirement ${requirementId}; the first rejection was retained.`);
      return false;
    }
    seen.add(rejection.evidenceClaimId);
    return true;
  });
}

function normalizeComplementaryEvidenceIds(
  complementaryEvidenceIds: string[],
  selectionId: string,
  selectedIds: string[],
  requirementId: string,
  validationWarnings: string[]
): string[] {
  const seen = new Set<string>();
  return complementaryEvidenceIds.filter((id) => {
    if (seen.has(id)) {
      validationWarnings.push(`Evidence Reasoner repeated complementary evidence ${id} for requirement ${requirementId}; the duplicate reference was removed.`);
      return false;
    }
    seen.add(id);
    if (id === selectionId || !selectedIds.includes(id)) {
      validationWarnings.push(`Evidence Reasoner referenced non-selected or self-referential complementary evidence ${id} for requirement ${requirementId}; the invalid optional reference was removed.`);
      return false;
    }
    return true;
  });
}

function candidateById(requirement: CandidateEvidencePack["requirements"][number], id: string): CandidateEvidence {
  if (!requirement.reasonerCandidateIds.includes(id)) {
    throw new Error(`Evidence reasoner referenced an unknown or out-of-scope evidence claim: ${id}`);
  }
  const candidate = requirement.candidates.find((value) => value.evidenceClaimId === id);
  if (!candidate) {
    throw new Error(`Evidence reasoner referenced an unknown or out-of-scope evidence claim: ${id}`);
  }
  return candidate;
}

function omittedCoverage(requirement: CandidateEvidencePack["requirements"][number]): RequirementCoverage {
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
    limitations: ["The Evidence Reasoner omitted a coverage decision even though canonical candidate evidence was available."],
    explanation: "The supplied canonical candidates were retained, but no bounded coverage decision was returned for this requirement."
  };
}

function validateCoverage(
  output: EvidenceReasoningOutput,
  pack: CandidateEvidencePack,
  validationWarnings: string[]
): RequirementCoverage[] {
  const requirementIds = new Set(pack.requirements.map((requirement) => requirement.requirementId));
  const knownCoverage = output.coverage.filter((entry) => {
    if (!requirementIds.has(entry.requirementId)) {
      validationWarnings.push(`Evidence Reasoner returned unknown requirement ${entry.requirementId}; the out-of-scope coverage entry was ignored.`);
      return false;
    }
    return true;
  });
  unique(knownCoverage.map((entry) => entry.requirementId), "requirement coverage entries");
  const coverageByRequirement = new Map(knownCoverage.map((entry) => [entry.requirementId, entry]));
  const result: RequirementCoverage[] = [];

  for (const requirement of pack.requirements) {
    const draft = coverageByRequirement.get(requirement.requirementId);
    if (!draft) {
      if (requirement.reasonerCandidateIds.length === 0) {
        result.push(missingCoverage(requirement));
        continue;
      }
      result.push(omittedCoverage(requirement));
      validationWarnings.push(`Evidence Reasoner omitted coverage for requirement ${requirement.requirementId}; it was recorded as missing without discarding its canonical candidates.`);
      continue;
    }
    const normalizedRejections = deduplicateRejections(draft.rejections, requirement.requirementId, validationWarnings);
    const selectedIds = draft.selections.map((selection) => selection.evidenceClaimId);
    const rejectedIds = normalizedRejections.map((rejection) => rejection.evidenceClaimId);
    unique(selectedIds, `selected evidence for ${requirement.requirementId}`);
    if (selectedIds.some((id) => rejectedIds.includes(id))) {
      throw new Error(`Evidence reasoner both selected and rejected the same evidence for ${requirement.requirementId}.`);
    }
    if (draft.coverageStatus === "missing" && selectedIds.length > 0) {
      throw new Error(`Evidence reasoner selected evidence for missing coverage: ${requirement.requirementId}`);
    }
    const selections: EvidenceSelection[] = draft.selections.map((selection) => {
      const complementaryEvidenceIds = normalizeComplementaryEvidenceIds(
        selection.complementaryEvidenceIds ?? [],
        selection.evidenceClaimId,
        selectedIds,
        requirement.requirementId,
        validationWarnings
      );
      return { ...selection, complementaryEvidenceIds: complementaryEvidenceIds.length ? complementaryEvidenceIds : undefined, evidence: candidateById(requirement, selection.evidenceClaimId) };
    });
    const rejections: EvidenceRejection[] = normalizedRejections.map((rejection) => ({
      evidenceClaimId: rejection.evidenceClaimId,
      reason: rejection.reason === "missing" ? "unsupported_scope" : rejection.reason,
      explanation: rejection.explanation,
      evidence: candidateById(requirement, rejection.evidenceClaimId)
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
  return result;
}

function normalizeJsonEnvelope(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseEvidenceReasoningOutput(content: string, pack: CandidateEvidencePack): Omit<EvidenceReasoningOutput, "coverage"> & { coverage: RequirementCoverage[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonEnvelope(content));
  } catch (error) {
    throw new Error(`Evidence Reasoner returned output that was not valid JSON (received ${content.length} characters).`, { cause: error });
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
    throw new Error(`Evidence Reasoner returned invalid structured output: ${output.error.issues.map((issue) => issue.message).join("; ")}`, { cause: output.error });
  }
  const validationWarnings: string[] = [];
  const coverage = validateCoverage(output.data, pack, validationWarnings);
  return {
    ...output.data,
    warnings: [...output.data.warnings, ...validationWarnings],
    coverage
  };
}
