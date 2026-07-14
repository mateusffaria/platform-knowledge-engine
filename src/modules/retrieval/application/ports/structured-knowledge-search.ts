import {
  EvidenceClaimStatus,
  HybridSearchCandidate,
  HybridSubjectType
} from "../types.js";

export interface StructuredKnowledgeSearchInput {
  query: string;
  terms: string[];
  limit: number;
  claimStatus?: EvidenceClaimStatus;
  subjectType?: HybridSubjectType;
  minStructuredScore?: number;
}

export interface StructuredKnowledgeSearch {
  search(input: StructuredKnowledgeSearchInput): Promise<HybridSearchCandidate[]>;
}
