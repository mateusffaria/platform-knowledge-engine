import { z } from "zod";

import { CuratedEvidencePack } from "../domain/model.js";

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
  evidence: candidateSchema
}).strict();
const rejectionSchema = z.object({
  evidenceClaimId: z.string().min(1),
  reason: z.enum(["irrelevant", "weak", "redundant", "unsupported_scope", "lower_quality_alternative", "insufficient_provenance"]),
  explanation: z.string().min(1),
  evidence: candidateSchema
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
  explanation: z.string().min(1)
}).strict();

export const curatedEvidenceContentSchema = z.object({
  overallCoverageSummary: z.string().min(1),
  requirementCoverage: z.array(coverageSchema),
  recommendedEvidence: z.array(selectionSchema),
  discardedEvidence: z.array(rejectionSchema),
  missingEvidence: z.array(z.object({ requirementId: z.string().min(1), requirementText: z.string().min(1), reason: z.string().min(1) }).strict()),
  warnings: z.array(z.string()),
  limitations: z.array(z.string()),
  displayScore: z.number().min(0).max(100).optional()
}).strict();

export function normalizeStoredCuratedEvidencePack(
  metadata: Omit<CuratedEvidencePack, "overallCoverageSummary" | "requirementCoverage" | "recommendedEvidence" | "discardedEvidence" | "missingEvidence" | "warnings" | "limitations" | "displayScore">,
  content: unknown
): CuratedEvidencePack {
  const parsed = curatedEvidenceContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error("Persisted curated evidence content is invalid.");
  }
  return { ...metadata, ...parsed.data };
}
