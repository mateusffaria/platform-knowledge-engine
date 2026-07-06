import { KnowledgePersistence } from "../db/persistence.js";
import { CanonicalCareerDocument } from "../domain/model.js";
import { ingestMarkdownFile } from "./markdown.js";

export interface IngestionPipelineResult {
  document: CanonicalCareerDocument;
}

export async function ingestMarkdownSource(
  filePath: string,
  persistence: KnowledgePersistence
): Promise<IngestionPipelineResult> {
  const { document } = await ingestMarkdownFile(filePath);
  await persistence.saveCanonicalCareerDocument(document);

  return { document };
}
