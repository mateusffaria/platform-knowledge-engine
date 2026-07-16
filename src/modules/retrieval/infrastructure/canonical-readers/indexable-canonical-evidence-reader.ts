import { IndexableEvidenceClaim, IndexableKnowledgeReader } from "../../../knowledge/application/ports/indexable-knowledge-reader.js";
import { CanonicalEvidenceReadInput, CanonicalEvidenceReadResult, CanonicalEvidenceReader } from "../../application/ports/canonical-evidence-reader.js";
import { HybridSearchCandidate } from "../../application/types.js";

function toCandidate(
  claim: IndexableEvidenceClaim,
  input: CanonicalEvidenceReadInput
): HybridSearchCandidate | undefined {
  if (!claim.id || !claim.knowledgeAssetId || !claim.sourceReferenceId || !claim.claimText || !claim.source || !claim.reference) {
    return undefined;
  }

  return {
    evidenceClaimId: claim.id,
    knowledgeAssetId: claim.knowledgeAssetId,
    subjectAssetId: claim.subjectAssetId,
    subjectType: claim.claimType,
    claimType: claim.claimType,
    claimCategory: claim.claimCategory,
    predicate: claim.predicate,
    claimText: claim.claimText,
    relatedAssetId: claim.relatedAssetId,
    valueText: claim.valueText,
    valueUnit: claim.valueUnit,
    claimStatus: claim.status,
    confidenceScore: claim.confidenceScore,
    semanticScore: input.semanticScore,
    structuredScore: input.structuredScore,
    sources: [{
      id: claim.reference.id,
      sourceDocumentId: claim.reference.sourceDocumentId,
      section: claim.reference.section,
      locator: claim.reference.locator,
      excerpt: claim.reference.excerpt,
      sourcePath: claim.source.path,
      sourceLanguage: claim.sourceLanguage ?? claim.reference.sourceLanguage,
      originalSectionLabel: claim.originalSectionLabel || claim.reference.originalSectionLabel
    }],
    retrievalStrategies: [...input.retrievalStrategies]
  };
}

/** Adapter from the canonical indexable-knowledge projection to retrieval. */
export class IndexableCanonicalEvidenceReader implements CanonicalEvidenceReader {
  private claims?: Promise<IndexableEvidenceClaim[]>;

  constructor(private readonly knowledgeReader: IndexableKnowledgeReader) {}

  async read(input: CanonicalEvidenceReadInput): Promise<CanonicalEvidenceReadResult> {
    this.claims ??= this.knowledgeReader.listIndexableEvidenceClaims();
    const claims = await this.claims;
    const addressed = input.evidenceClaimId
      ? claims.filter((claim) => claim.id === input.evidenceClaimId)
      : claims.filter((claim) => claim.knowledgeAssetId === input.knowledgeAssetId);

    if (addressed.length === 0) {
      return {
        kind: "discarded",
        reasonCode: "canonical_claim_not_found",
        reason: input.evidenceClaimId
          ? `Canonical evidence claim ${input.evidenceClaimId} was not found.`
          : `No canonical evidence claims were found for knowledge asset ${input.knowledgeAssetId}.`
      };
    }

    if (input.evidenceClaimId && addressed[0].knowledgeAssetId !== input.knowledgeAssetId) {
      return {
        kind: "discarded",
        reasonCode: "canonical_identity_mismatch",
        reason: `Canonical claim ${input.evidenceClaimId} belongs to knowledge asset ${addressed[0].knowledgeAssetId}, not ${input.knowledgeAssetId}.`
      };
    }

    const candidates = addressed
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((claim) => toCandidate(claim, input));
    if (candidates.some((candidate) => candidate === undefined)) {
      return {
        kind: "discarded",
        reasonCode: "unsupported_legacy_record",
        reason: "A canonical claim is missing required identity or provenance fields and cannot be safely hydrated."
      };
    }

    return { kind: "hydrated", candidates: candidates as HybridSearchCandidate[] };
  }
}
