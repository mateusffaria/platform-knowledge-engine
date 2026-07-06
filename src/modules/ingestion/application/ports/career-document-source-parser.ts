import { CanonicalCareerDocument } from "../../../knowledge/domain/model.js";

export interface CareerDocumentSourceParser {
  parse(filePath: string): Promise<{
    document: CanonicalCareerDocument;
  }>;
}
