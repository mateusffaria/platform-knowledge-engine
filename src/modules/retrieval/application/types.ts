import {
  IndexableEvidenceClaim,
  IndexableKnowledgeAsset
} from "../../knowledge/application/ports/indexable-knowledge-reader.js";

export type EmbeddingSubjectType = "knowledge_asset" | "evidence_claim";

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
