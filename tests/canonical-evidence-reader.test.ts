import { describe, expect, it } from "vitest";

import { IndexableKnowledgeReader } from "../src/modules/knowledge/application/ports/indexable-knowledge-reader.js";
import { IndexableCanonicalEvidenceReader } from "../src/modules/retrieval/infrastructure/canonical-readers/indexable-canonical-evidence-reader.js";

function claim(id: string, assetId: string, status: "confirmed" | "single_source" = "confirmed") {
  return {
    id,
    knowledgeAssetId: assetId,
    subjectAssetId: assetId,
    sourceReferenceId: `reference-${id}`,
    claimType: "experience" as const,
    claimCategory: "capability" as const,
    predicate: "demonstrates" as const,
    claimText: `Claim ${id}`,
    status,
    confidenceScore: 80,
    conflictSeverity: "none" as const,
    originalSectionLabel: "Experience",
    asset: { id: assetId, title: "Pismo", assetType: "experience" as const, sourceDocumentId: "source-1" },
    source: { id: "source-1", path: "profile.md", contentHash: "hash", sourceType: "markdown" as const },
    reference: { id: `reference-${id}`, sourceDocumentId: "source-1", section: "Experience", locator: "line:1", excerpt: `Claim ${id}`, originalSectionLabel: "Experience" },
    verified: status === "confirmed"
  };
}

function reader(claims: ReturnType<typeof claim>[]): IndexableCanonicalEvidenceReader {
  const knowledgeReader: IndexableKnowledgeReader = {
    async listIndexableKnowledgeAssets() { return []; },
    async listIndexableEvidenceClaims() { return claims; }
  };
  return new IndexableCanonicalEvidenceReader(knowledgeReader);
}

describe("canonical evidence reader", () => {
  it("hydrates a claim identity directly and retains canonical status and provenance", async () => {
    const result = await reader([claim("claim-go", "asset-go", "single_source")]).read({
      evidenceClaimId: "claim-go",
      knowledgeAssetId: "asset-go",
      retrievalStrategies: ["semantic"],
      semanticScore: 0.77
    });

    expect(result).toEqual(expect.objectContaining({
      kind: "hydrated",
      candidates: [expect.objectContaining({
        evidenceClaimId: "claim-go",
        knowledgeAssetId: "asset-go",
        claimStatus: "single_source",
        semanticScore: 0.77,
        sources: [expect.objectContaining({ id: "reference-claim-go" })]
      })]
    }));
  });

  it("resolves an asset identity to every canonical claim in deterministic order", async () => {
    const result = await reader([claim("claim-b", "asset-pismo"), claim("claim-a", "asset-pismo")]).read({
      knowledgeAssetId: "asset-pismo",
      retrievalStrategies: ["semantic"]
    });

    expect(result).toMatchObject({ kind: "hydrated" });
    if (result.kind === "hydrated") {
      expect(result.candidates.map((candidate) => candidate.evidenceClaimId)).toEqual(["claim-a", "claim-b"]);
    }
  });

  it("returns explicit identity and missing-claim diagnostics", async () => {
    const canonicalReader = reader([claim("claim-go", "asset-go")]);
    await expect(canonicalReader.read({
      evidenceClaimId: "claim-go",
      knowledgeAssetId: "asset-other",
      retrievalStrategies: ["semantic"]
    })).resolves.toMatchObject({ kind: "discarded", reasonCode: "canonical_identity_mismatch" });
    await expect(canonicalReader.read({
      evidenceClaimId: "claim-missing",
      knowledgeAssetId: "asset-missing",
      retrievalStrategies: ["semantic"]
    })).resolves.toMatchObject({ kind: "discarded", reasonCode: "canonical_claim_not_found" });
  });

  it("reports unsupported legacy canonical records instead of dropping them", async () => {
    const legacy = { ...claim("claim-legacy", "asset-legacy"), reference: undefined } as unknown as ReturnType<typeof claim>;

    await expect(reader([legacy]).read({
      evidenceClaimId: "claim-legacy",
      knowledgeAssetId: "asset-legacy",
      retrievalStrategies: ["semantic"]
    })).resolves.toMatchObject({ kind: "discarded", reasonCode: "unsupported_legacy_record" });
  });
});
