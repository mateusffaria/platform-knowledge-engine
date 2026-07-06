import { KnowledgePersistence } from "../modules/knowledge/application/ports/knowledge-persistence.js";
import { MarkdownCareerDocumentParser } from "../modules/ingestion/infrastructure/parsers/markdown.js";
import {
  createIngestCareerSourceUseCase,
  IngestionPipelineResult
} from "../modules/ingestion/application/use-cases/ingest-career-source.js";

export async function ingestMarkdownSource(
  filePath: string,
  persistence: KnowledgePersistence
): Promise<IngestionPipelineResult> {
  const useCase = createIngestCareerSourceUseCase({
    parser: new MarkdownCareerDocumentParser(),
    persistence
  });

  return useCase.execute({ sourcePath: filePath });
}
