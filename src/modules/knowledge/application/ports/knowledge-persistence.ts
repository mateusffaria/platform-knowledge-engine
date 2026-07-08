import { CanonicalCareerDocument } from "../../domain/model.js";

export interface KnowledgePersistence {
  hasSourceDocumentVersion(identity: { path: string; contentHash: string }): Promise<boolean>;
  saveCanonicalCareerDocument(document: CanonicalCareerDocument): Promise<void>;
}
