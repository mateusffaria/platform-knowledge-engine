import {
  EvidenceClaim,
  KnowledgeAsset,
  SourceDocument,
  SourceReference
} from "../../domain/model.js";

export type IndexableKnowledgeAsset = KnowledgeAsset & {
  source: Pick<SourceDocument, "id" | "path" | "contentHash" | "sourceType">;
};

export type IndexableEvidenceClaim = EvidenceClaim & {
  asset: Pick<KnowledgeAsset, "id" | "title" | "summary" | "assetType" | "sourceDocumentId">;
  source: Pick<SourceDocument, "id" | "path" | "contentHash" | "sourceType">;
  reference: SourceReference;
  verified: boolean;
};

export interface IndexableKnowledgeReader {
  listIndexableKnowledgeAssets(): Promise<IndexableKnowledgeAsset[]>;
  listIndexableEvidenceClaims(): Promise<IndexableEvidenceClaim[]>;
}
