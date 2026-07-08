import { KnowledgePersistence } from "../../../knowledge/application/ports/knowledge-persistence.js";
import { CanonicalCareerDocument } from "../../../knowledge/domain/model.js";
import { CareerDocumentSourceParser } from "../ports/career-document-source-parser.js";

export interface IngestionPipelineResult {
  document: CanonicalCareerDocument;
  created: boolean;
}

export interface IngestCareerSourceCommand {
  sourcePath: string;
}

export interface IngestCareerSourceDependencies {
  parser: CareerDocumentSourceParser;
  persistence: KnowledgePersistence;
}

export function createIngestCareerSourceUseCase(dependencies: IngestCareerSourceDependencies) {
  return {
    async execute(command: IngestCareerSourceCommand): Promise<IngestionPipelineResult> {
      const { document } = await dependencies.parser.parse(command.sourcePath);
      const alreadyIngested = await dependencies.persistence.hasSourceDocumentVersion({
        path: document.source.path,
        contentHash: document.source.contentHash
      });

      if (alreadyIngested) {
        return { document, created: false };
      }

      await dependencies.persistence.saveCanonicalCareerDocument(document);

      return { document, created: true };
    }
  };
}
