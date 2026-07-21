import { z } from "zod";

import { CuratedEvidencePack } from "../domain/model.js";
import { atomicRequirementComponentId, normalizeWarnings } from "../domain/atomic-job-requirement.js";

const sourceSchema = z.object({
  sourceDocumentId: z.string().min(1),
  sourceReferenceId: z.string().min(1).optional(),
  locator: z.string().optional(),
  excerpt: z.string(),
  sourcePath: z.string().optional(),
  sourceLanguage: z.string().optional(),
  originalSectionLabel: z.string().optional()
}).strict();
const candidateSchema = z.object({
  evidenceClaimId: z.string().min(1),
  knowledgeAssetId: z.string().min(1),
  subjectAssetId: z.string().optional(),
  subjectType: z.string().min(1),
  claimType: z.string().optional(),
  claimCategory: z.string().optional(),
  predicate: z.string().optional(),
  claimText: z.string().min(1),
  relatedAssetId: z.string().optional(),
  valueText: z.string().optional(),
  valueUnit: z.string().optional(),
  claimStatus: z.string().optional(),
  sources: z.array(sourceSchema),
  objectiveSignals: z.object({
    confidenceScore: z.number(),
    finalScore: z.number(),
    semanticScore: z.number().optional(),
    structuredScore: z.number().optional(),
    retrievalStrategies: z.array(z.string())
  }).strict()
}).strict();
const selectionSchema = z.object({
  evidenceClaimId: z.string().min(1),
  reason: z.string().min(1),
  contribution: z.string().min(1),
  complementaryEvidenceIds: z.array(z.string().min(1)).optional(),
  exaggerationRisk: z.enum(["low", "medium", "high"]),
  evidence: candidateSchema,
  addressedRequirementIds: z.array(z.string().min(1)).optional(),
  addressedComponentIds: z.array(z.string().min(1)).optional()
}).strict();
const rejectionSchema = z.object({
  evidenceClaimId: z.string().min(1),
  reason: z.enum(["irrelevant", "weak", "redundant", "unsupported_scope", "lower_quality_alternative", "insufficient_provenance"]),
  explanation: z.string().min(1),
  evidence: candidateSchema,
  addressedRequirementIds: z.array(z.string().min(1)).optional(),
  addressedComponentIds: z.array(z.string().min(1)).optional()
}).strict();
const componentCoverageSchema = z.object({
  requirementId: z.string().min(1),
  componentId: z.string().min(1),
  componentIndex: z.number().int().nonnegative().optional(),
  componentText: z.string().min(1),
  importance: z.enum(["required", "preferred"]),
  coverageStatus: z.enum(["strong", "partial", "weak", "missing"]),
  selectedEvidenceIds: z.array(z.string().min(1)),
  rejectedCandidateEvidenceIds: z.array(z.string().min(1)),
  selections: z.array(selectionSchema),
  rejections: z.array(rejectionSchema),
  strengthFactors: z.array(z.string()),
  limitations: z.array(z.string()),
  explanation: z.string().min(1)
}).strict();
const coverageSchema = z.object({
  requirementId: z.string().min(1),
  requirementText: z.string().min(1),
  importance: z.enum(["required", "preferred"]),
  coverageStatus: z.enum(["strong", "partial", "weak", "missing"]),
  selectedEvidenceIds: z.array(z.string().min(1)),
  rejectedCandidateEvidenceIds: z.array(z.string().min(1)),
  selections: z.array(selectionSchema),
  rejections: z.array(rejectionSchema),
  strengthFactors: z.array(z.string()),
  limitations: z.array(z.string()),
  explanation: z.string().min(1),
  componentCoverage: z.array(componentCoverageSchema).optional()
}).strict();

export const curatedEvidenceContentSchema = z.object({
  overallCoverageSummary: z.string().min(1),
  requirementCoverage: z.array(coverageSchema),
  recommendedEvidence: z.array(selectionSchema),
  discardedEvidence: z.array(rejectionSchema),
  missingEvidence: z.array(z.object({
    requirementId: z.string().min(1),
    requirementText: z.string().min(1),
    componentId: z.string().min(1).optional(),
    componentText: z.string().min(1).optional(),
    reason: z.string().min(1)
  }).strict()),
  warnings: z.array(z.string()),
  warningDiagnostics: z.array(z.object({ code: z.string().min(1), message: z.string().min(1) }).strict()).optional(),
  limitations: z.array(z.string()),
  displayScore: z.number().min(0).max(100).optional()
}).strict();

export function normalizeStoredCuratedEvidencePack(
  metadata: Omit<CuratedEvidencePack, "overallCoverageSummary" | "requirementCoverage" | "recommendedEvidence" | "discardedEvidence" | "missingEvidence" | "warnings" | "warningDiagnostics" | "limitations" | "displayScore">,
  content: unknown
): CuratedEvidencePack {
  const parsed = curatedEvidenceContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error("Persisted curated evidence content is invalid.");
  }
  const requirementCoverage = parsed.data.requirementCoverage.map((coverage) => {
    if (coverage.componentCoverage && coverage.componentCoverage.length > 0) return coverage;
    const componentId = atomicRequirementComponentId({
      requirementId: coverage.requirementId,
      index: 0,
      originalText: coverage.requirementText,
      sourceTextStart: 0,
      sourceTextEnd: coverage.requirementText.length
    });
    return {
      ...coverage,
      componentCoverage: [{
        requirementId: coverage.requirementId,
        componentId,
        componentIndex: 0,
        componentText: coverage.requirementText,
        importance: coverage.importance,
        coverageStatus: coverage.coverageStatus,
        selectedEvidenceIds: [...coverage.selectedEvidenceIds],
        rejectedCandidateEvidenceIds: [...coverage.rejectedCandidateEvidenceIds],
        selections: coverage.selections.map((selection) => ({
          ...selection,
          addressedRequirementIds: selection.addressedRequirementIds ?? [coverage.requirementId],
          addressedComponentIds: selection.addressedComponentIds ?? [componentId]
        })),
        rejections: coverage.rejections.map((rejection) => ({
          ...rejection,
          addressedRequirementIds: rejection.addressedRequirementIds ?? [coverage.requirementId],
          addressedComponentIds: rejection.addressedComponentIds ?? [componentId]
        })),
        strengthFactors: [...coverage.strengthFactors],
        limitations: [...coverage.limitations],
        explanation: coverage.explanation
      }]
    };
  });
  const warningDiagnostics = normalizeWarnings(parsed.data.warningDiagnostics ?? parsed.data.warnings, "legacy_warning");
  return {
    ...metadata,
    ...parsed.data,
    requirementCoverage,
    warnings: warningDiagnostics.map((warning) => warning.message),
    warningDiagnostics
  };
}
