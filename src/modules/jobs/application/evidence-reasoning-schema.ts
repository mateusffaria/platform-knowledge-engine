import { z } from "zod";

import {
  CandidateEvidence,
  CandidateEvidencePack,
  CandidateRequirementComponentEvidence,
  CoverageStatus,
  EvidenceRejection,
  EvidenceSelection,
  RequirementComponentCoverage,
  RequirementCoverage
} from "../domain/model.js";
import { candidateComponentsOf } from "../domain/atomic-job-requirement.js";
import { aggregateRequirementCoverage } from "./evidence-curation.js";

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
  componentId: z.string().trim().min(1).optional(),
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
        required: ["requirementId", "componentId", "coverageStatus", "selections", "rejections", "strengthFactors", "limitations", "explanation"],
        properties: {
          requirementId: { type: "string", minLength: 1 },
          componentId: { type: "string", minLength: 1 },
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

function deduplicateCoverage(
  coverage: EvidenceReasoningOutput["coverage"],
  validationWarnings: string[]
): EvidenceReasoningOutput["coverage"] {
  const seen = new Set<string>();
  return coverage.filter((entry) => {
    const key = `${entry.requirementId}\u0000${entry.componentId ?? "legacy-singleton"}`;
    if (seen.has(key)) {
      validationWarnings.push(`Evidence Reasoner repeated coverage for requirement ${entry.requirementId}; the first coverage decision was retained.`);
      return false;
    }
    seen.add(key);
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

function candidateById(component: CandidateRequirementComponentEvidence, id: string): CandidateEvidence {
  if (!component.reasonerCandidateIds.includes(id)) {
    throw new Error(`Evidence reasoner referenced an unknown or out-of-scope evidence claim: ${id}`);
  }
  const candidate = component.candidates.find((value) => value.evidenceClaimId === id);
  if (!candidate) {
    throw new Error(`Evidence reasoner referenced an unknown or out-of-scope evidence claim: ${id}`);
  }
  return candidate;
}

function missingComponentCoverage(
  requirement: CandidateEvidencePack["requirements"][number],
  component: CandidateRequirementComponentEvidence,
  omitted: boolean
): RequirementComponentCoverage {
  return {
    requirementId: requirement.requirementId,
    componentId: component.componentId,
    componentIndex: component.componentIndex,
    componentText: component.componentText,
    importance: component.importance,
    coverageStatus: "missing",
    selectedEvidenceIds: [],
    rejectedCandidateEvidenceIds: [],
    selections: [],
    rejections: [],
    strengthFactors: [],
    limitations: [omitted
      ? "The Evidence Reasoner omitted a coverage decision for this atomic component even though canonical candidate evidence was available."
      : "No eligible canonical evidence was supplied for this atomic component."],
    explanation: omitted
      ? "The supplied canonical candidates were retained, but no bounded coverage decision was returned for this atomic component."
      : "No eligible canonical evidence was supplied; component coverage cannot be established."
  };
}

function validateCoverage(
  output: EvidenceReasoningOutput,
  pack: CandidateEvidencePack,
  validationWarnings: string[]
): RequirementCoverage[] {
  const requirementsById = new Map(pack.requirements.map((requirement) => [requirement.requirementId, requirement]));
  const resolvedCoverage = output.coverage.flatMap((entry) => {
    const requirement = requirementsById.get(entry.requirementId);
    if (!requirement) {
      validationWarnings.push(`Evidence Reasoner returned unknown requirement ${entry.requirementId}; the out-of-scope coverage entry was ignored.`);
      return [];
    }
    const components = candidateComponentsOf(requirement);
    if (entry.componentId) {
      if (!components.some((component) => component.componentId === entry.componentId)) {
        throw new Error(`Evidence reasoner referenced an unknown component ${entry.componentId} for requirement ${entry.requirementId}.`);
      }
      return [{ ...entry, componentId: entry.componentId }];
    }
    if (components.length !== 1) {
      throw new Error(`Evidence reasoner omitted componentId for compound requirement ${entry.requirementId}.`);
    }
    return [{ ...entry, componentId: components[0].componentId }];
  });
  const coverageByComponent = new Map(
    deduplicateCoverage(resolvedCoverage, validationWarnings).map((entry) => [`${entry.requirementId}\u0000${entry.componentId}`, entry])
  );
  const result: RequirementCoverage[] = [];

  for (const requirement of pack.requirements) {
    const componentCoverage: RequirementComponentCoverage[] = [];
    for (const component of candidateComponentsOf(requirement)) {
      const draft = coverageByComponent.get(`${requirement.requirementId}\u0000${component.componentId}`);
      if (!draft) {
        const omitted = component.reasonerCandidateIds.length > 0;
        componentCoverage.push(missingComponentCoverage(requirement, component, omitted));
        if (omitted) {
          validationWarnings.push(`Evidence Reasoner omitted coverage for requirement ${requirement.requirementId} component ${component.componentId}; it was recorded as missing without discarding its canonical candidates.`);
        }
        continue;
      }
      const normalizedRejections = deduplicateRejections(draft.rejections, requirement.requirementId, validationWarnings);
      const selectedIds = draft.selections.map((selection) => selection.evidenceClaimId);
      const rejectedIds = normalizedRejections.map((rejection) => rejection.evidenceClaimId);
      unique(selectedIds, `selected evidence for ${requirement.requirementId} component ${component.componentId}`);
      if (selectedIds.some((id) => rejectedIds.includes(id))) {
        throw new Error(`Evidence reasoner both selected and rejected the same evidence for ${requirement.requirementId} component ${component.componentId}.`);
      }
      if (draft.coverageStatus === "missing" && selectedIds.length > 0) {
        throw new Error(`Evidence reasoner selected evidence for missing coverage: ${component.componentId}`);
      }
      const selections: EvidenceSelection[] = draft.selections.map((selection) => {
        const complementaryEvidenceIds = normalizeComplementaryEvidenceIds(
          selection.complementaryEvidenceIds ?? [],
          selection.evidenceClaimId,
          selectedIds,
          requirement.requirementId,
          validationWarnings
        );
        return {
          ...selection,
          complementaryEvidenceIds: complementaryEvidenceIds.length ? complementaryEvidenceIds : undefined,
          evidence: candidateById(component, selection.evidenceClaimId),
          addressedRequirementIds: [requirement.requirementId],
          addressedComponentIds: [component.componentId]
        };
      });
      const rejections: EvidenceRejection[] = normalizedRejections.map((rejection) => ({
        evidenceClaimId: rejection.evidenceClaimId,
        reason: rejection.reason === "missing" ? "unsupported_scope" : rejection.reason,
        explanation: rejection.explanation,
        evidence: candidateById(component, rejection.evidenceClaimId),
        addressedRequirementIds: [requirement.requirementId],
        addressedComponentIds: [component.componentId]
      }));
      const onlySkillSelection = selections.length === 1 && selections[0].evidence.claimType === "skill";
      if (draft.coverageStatus === "strong" && onlySkillSelection) {
        throw new Error(`Evidence reasoner marked isolated skill-only evidence as strong coverage for ${component.componentId}.`);
      }
      componentCoverage.push({
        requirementId: requirement.requirementId,
        componentId: component.componentId,
        componentIndex: component.componentIndex,
        componentText: component.componentText,
        importance: component.importance,
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
    result.push(aggregateRequirementCoverage({
      requirementId: requirement.requirementId,
      requirementText: requirement.requirementText,
      importance: requirement.importance,
      componentCoverage
    }));
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
