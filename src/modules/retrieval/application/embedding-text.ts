import { createHash } from "node:crypto";

import {
  IndexableEvidenceClaim,
  IndexableKnowledgeAsset
} from "../../knowledge/application/ports/indexable-knowledge-reader.js";
import { EmbeddingDocument } from "./types.js";

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function lines(fields: Array<[string, string | undefined]>): string {
  return fields
    .map(([label, value]) => `${label}: ${normalizeText(value)}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n");
}

export function buildKnowledgeAssetEmbeddingDocument(asset: IndexableKnowledgeAsset): EmbeddingDocument {
  const text = lines([
    ["subject_type", "knowledge_asset"],
    ["knowledge_asset_id", asset.id],
    ["source_document_id", asset.source.id],
    ["source_path", asset.source.path],
    ["source_content_hash", asset.source.contentHash],
    ["asset_type", asset.assetType],
    ["title", asset.title],
    ["summary", asset.summary]
  ]);

  return {
    subjectType: "knowledge_asset",
    subjectId: asset.id,
    knowledgeAssetId: asset.id,
    sourceDocumentId: asset.source.id,
    text,
    textHash: hashText(text)
  };
}

export function buildEvidenceClaimEmbeddingDocument(claim: IndexableEvidenceClaim): EmbeddingDocument {
  const text = lines([
    ["subject_type", "evidence_claim"],
    ["evidence_claim_id", claim.id],
    ["knowledge_asset_id", claim.knowledgeAssetId],
    ["subject_asset_id", claim.subjectAssetId],
    ["related_asset_id", claim.relatedAssetId],
    ["source_document_id", claim.source.id],
    ["source_reference_id", claim.reference.id],
    ["source_path", claim.source.path],
    ["source_content_hash", claim.source.contentHash],
    ["source_section", claim.reference.section],
    ["source_locator", claim.reference.locator],
    ["source_language", claim.sourceLanguage ?? claim.reference.sourceLanguage],
    ["original_section_label", claim.originalSectionLabel ?? claim.reference.originalSectionLabel],
    ["claim_type", claim.claimType],
    ["claim_category", claim.claimCategory],
    ["predicate", claim.predicate],
    ["claim_status", claim.status],
    ["confidence_score", String(claim.confidenceScore)],
    ["value_text", claim.valueText],
    ["value_unit", claim.valueUnit],
    ["claim_text", claim.claimText],
    ["source_excerpt", claim.reference.excerpt],
    ["asset_title", claim.asset.title],
    ["asset_summary", claim.asset.summary]
  ]);

  return {
    subjectType: "evidence_claim",
    subjectId: claim.id,
    knowledgeAssetId: claim.knowledgeAssetId,
    evidenceClaimId: claim.id,
    sourceDocumentId: claim.source.id,
    sourceReferenceId: claim.reference.id,
    text,
    textHash: hashText(text)
  };
}
