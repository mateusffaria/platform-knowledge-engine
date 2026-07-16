import {
  IndexableEvidenceClaim,
  IndexableKnowledgeAsset
} from "../../knowledge/application/ports/indexable-knowledge-reader.js";

export type EmbeddingSubjectType = "knowledge_asset" | "evidence_claim";
export type RetrievalStrategy = "structured" | "semantic";
export type MetadataCategory =
  | "skill"
  | "technology"
  | "organization"
  | "role"
  | "project"
  | "product"
  | "initiative";
export type MetadataMatchType = "exact" | "prefix" | "partial" | "alias";
export const pkqlFilterFields = [
  "company",
  "role",
  "technology",
  "skill",
  "project",
  "status",
  "after",
  "before",
  "type"
] as const;
export type PkqlFilterField = typeof pkqlFilterFields[number];
export type PkqlDateFilterField = "after" | "before";
export type EvidenceClaimStatus = "confirmed" | "single_source" | "needs_review" | "rejected" | "superseded";
export type TrustedEvidenceClaimStatus = "confirmed" | "single_source";
export type EvidenceClaimType = "skill" | "experience" | "project" | "achievement";
export type EvidenceClaimCategory = "fact" | "responsibility" | "achievement" | "metric" | "capability" | "relationship";
export type EvidenceClaimPredicate =
  | "works_at"
  | "holds_role"
  | "uses_technology"
  | "participated_in"
  | "occurred_during"
  | "reduced_processing_time"
  | "reduced_cost"
  | "improved_reliability"
  | "demonstrates";
export type HybridSubjectType = EmbeddingSubjectType | EvidenceClaimType;

export type IndexableKnowledgeRecord = IndexableKnowledgeAsset | IndexableEvidenceClaim;

export interface EmbeddingDocument {
  subjectType: EmbeddingSubjectType;
  subjectId: string;
  knowledgeAssetId: string;
  evidenceClaimId?: string;
  sourceDocumentId: string;
  sourceReferenceId?: string;
  text: string;
  textHash: string;
}

export interface EmbeddingVector {
  provider: string;
  model: string;
  dimensions: number;
  values: number[];
}

export interface IndexSummary {
  indexed: number;
  skipped: number;
}

export interface SearchQuery {
  query: string;
  limit?: number;
  minScore?: number;
}

export interface TextPkqlFilterValue {
  kind: "text";
  value: string;
  rawValue: string;
}

export interface DatePkqlFilterValue {
  kind: "date";
  value: string;
  rawValue: string;
}

export type PkqlFilterValue = TextPkqlFilterValue | DatePkqlFilterValue;

export interface SearchFilter {
  field: PkqlFilterField;
  value: PkqlFilterValue;
}

export interface QueryDiagnostic {
  message: string;
}

export interface QueryAst {
  originalQuery: string;
  semanticText: string;
  filters: SearchFilter[];
  diagnostics: QueryDiagnostic[];
}

export interface MetadataMatch {
  category: MetadataCategory;
  value: string;
  normalizedValue: string;
  matchType: MetadataMatchType;
  matchedText: string;
  alias?: string;
}

export interface SearchResult {
  subjectType: EmbeddingSubjectType;
  subjectId: string;
  knowledgeAssetId: string;
  evidenceClaimId?: string;
  sourceDocumentId: string;
  sourceReferenceId?: string;
  similarityScore: number;
  text: string;
}

export interface SearchResultsFound {
  status: "results";
  query: string;
  limit: number;
  minScore?: number;
  results: SearchResult[];
}

export interface NoRelevantEvidence {
  status: "no_relevant_evidence";
  query: string;
  limit: number;
  minScore: number;
  bestSimilarityScore?: number;
  results: [];
}

export type SearchKnowledgeResult = SearchResultsFound | NoRelevantEvidence;

export interface EvidenceSourceReference {
  id: string;
  sourceDocumentId: string;
  section?: string;
  locator?: string;
  excerpt: string;
  sourcePath?: string;
  sourceLanguage?: string;
  originalSectionLabel?: string;
}

export interface EvidenceItem {
  evidenceClaimId?: string;
  knowledgeAssetId: string;
  subjectAssetId?: string;
  subjectType: HybridSubjectType;
  claimType?: EvidenceClaimType;
  claimCategory?: EvidenceClaimCategory;
  predicate?: EvidenceClaimPredicate;
  claimText: string;
  relatedAssetId?: string;
  valueText?: string;
  valueUnit?: string;
  claimStatus?: EvidenceClaimStatus;
  confidenceScore: number;
  semanticScore?: number;
  structuredScore?: number;
  /**
   * Retrieval ranking score used for ordering evidence; this is not an
   * objective probability that the claim is true.
   */
  finalScore: number;
  sources: EvidenceSourceReference[];
  retrievalStrategies: RetrievalStrategy[];
}

export interface EvidencePack {
  /** Present when retrieval was issued for one deterministic job requirement. */
  requirementId?: string;
  query: string;
  strategies: RetrievalStrategy[];
  items: EvidenceItem[];
  diagnostics: RetrievalDiagnostics;
  generatedAt: Date;
  warnings: string[];
}

export type RetrievalDiscardReason =
  | "claim_status_unavailable"
  | "ineligible_claim_status"
  | "claim_status_filter_mismatch"
  | "subject_type_filter_mismatch"
  | "minimum_score_not_met";

export interface RetrievalDiscardedResult {
  reasonCode: RetrievalDiscardReason;
  reason: string;
  evidenceClaimId?: string;
  knowledgeAssetId: string;
  retrievalStrategies: RetrievalStrategy[];
  semanticScore?: number;
  structuredScore?: number;
  finalScore?: number;
}

/**
 * Retrieval diagnostics preserve candidates before the final Evidence Pack is
 * narrowed. Consumers that need canonical hydration must use these records,
 * not reconstruct candidates from embedding text or final display results.
 */
export interface RetrievalDiagnostics {
  requirementId?: string;
  rawStructuredResultCount: number;
  rawSemanticResultCount: number;
  rawResults: HybridSearchCandidate[];
  eligibleResults: HybridSearchCandidate[];
  discardedResults: RetrievalDiscardedResult[];
}

export interface HybridSearchInput {
  requirementId?: string;
  query: string;
  limit?: number;
  minScore?: number;
  claimStatus?: EvidenceClaimStatus;
  subjectType?: HybridSubjectType;
}

export interface RankingConfig {
  confirmedStatusBoost: number;
  singleSourceStatusBoost: number;
  confidenceScoreWeight: number;
  structuredScoreWeight: number;
  semanticScoreWeight: number;
  exactStructuredMatchBoost: number;
}

export const defaultRankingConfig: RankingConfig = {
  confirmedStatusBoost: 0.2,
  singleSourceStatusBoost: 0.1,
  confidenceScoreWeight: 0.2,
  structuredScoreWeight: 0.45,
  semanticScoreWeight: 0.35,
  exactStructuredMatchBoost: 0.15
};

export interface PlannedQuery {
  query: string;
  semanticText: string;
  strategies: RetrievalStrategy[];
  metadataMatches: MetadataMatch[];
  structuredTerms: string[];
  filters: SearchFilter[];
  diagnostics: QueryDiagnostic[];
}

export interface HybridSearchCandidate {
  evidenceClaimId?: string;
  knowledgeAssetId: string;
  subjectAssetId?: string;
  subjectType: HybridSubjectType;
  claimType?: EvidenceClaimType;
  claimCategory?: EvidenceClaimCategory;
  predicate?: EvidenceClaimPredicate;
  claimText: string;
  relatedAssetId?: string;
  valueText?: string;
  valueUnit?: string;
  claimStatus?: EvidenceClaimStatus;
  confidenceScore: number;
  semanticScore?: number;
  structuredScore?: number;
  sources: EvidenceSourceReference[];
  retrievalStrategies: RetrievalStrategy[];
}
