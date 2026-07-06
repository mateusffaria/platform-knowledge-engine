import { CanonicalCareerDocument } from "../../domain/model.js";

export interface KnowledgePersistence {
  saveCanonicalCareerDocument(document: CanonicalCareerDocument): Promise<void>;
}
