import {
  EvidenceClaimStatus,
  HybridSearchCandidate,
  HybridSubjectType,
  SearchFilter
} from "../types.js";

export interface StructuredKnowledgeSearchInput {
  query: string;
  terms: string[];
  filters: SearchFilter[];
  limit: number;
  claimStatus?: EvidenceClaimStatus;
  subjectType?: HybridSubjectType;
  minStructuredScore?: number;
}

export interface StructuredKnowledgeSearch {
  search(input: StructuredKnowledgeSearchInput): Promise<HybridSearchCandidate[]>;
}
