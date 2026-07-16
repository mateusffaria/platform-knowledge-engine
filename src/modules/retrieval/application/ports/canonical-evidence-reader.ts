import { HybridSearchCandidate, RetrievalStrategy } from "../types.js";

export interface CanonicalEvidenceReadInput {
  evidenceClaimId?: string;
  knowledgeAssetId: string;
  retrievalStrategies: RetrievalStrategy[];
  semanticScore?: number;
  structuredScore?: number;
}

export type CanonicalEvidenceReadResult =
  | {
    kind: "hydrated";
    candidates: HybridSearchCandidate[];
  }
  | {
    kind: "discarded";
    reasonCode: "canonical_claim_not_found" | "canonical_identity_mismatch" | "unsupported_legacy_record";
    reason: string;
  };

/**
 * Hydrates retrieval projections from the canonical evidence store. A result
 * addressed to a claim resolves that claim directly; an asset result resolves
 * all claims belonging to the asset in deterministic claim-id order.
 */
export interface CanonicalEvidenceReader {
  read(input: CanonicalEvidenceReadInput): Promise<CanonicalEvidenceReadResult>;
}
