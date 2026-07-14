import {
  IndexableEvidenceClaim,
  IndexableKnowledgeAsset
} from "../../knowledge/application/ports/indexable-knowledge-reader.js";

export type EmbeddingSubjectType = "knowledge_asset" | "evidence_claim";
export type RetrievalStrategy = "structured" | "semantic";
export type EvidenceClaimStatus = "confirmed" | "single_source" | "needs_review" | "rejected" | "superseded";
export type TrustedEvidenceClaimStatus = "confirmed" | "single_source";
export type EvidenceClaimType = "skill" | "experience" | "project" | "achievement";
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
}

export interface EvidenceItem {
  evidenceClaimId?: string;
  knowledgeAssetId: string;
  subjectType: HybridSubjectType;
  claimType?: EvidenceClaimType;
  claimText: string;
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
  query: string;
  strategies: RetrievalStrategy[];
  items: EvidenceItem[];
  generatedAt: Date;
  warnings: string[];
}

export interface HybridSearchInput {
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
  strategies: RetrievalStrategy[];
  structuredTerms: string[];
}

export interface HybridSearchCandidate {
  evidenceClaimId?: string;
  knowledgeAssetId: string;
  subjectType: HybridSubjectType;
  claimType?: EvidenceClaimType;
  claimText: string;
  claimStatus?: EvidenceClaimStatus;
  confidenceScore: number;
  semanticScore?: number;
  structuredScore?: number;
  sources: EvidenceSourceReference[];
  retrievalStrategies: RetrievalStrategy[];
}
