#!/usr/bin/env node
import { Command } from "commander";

import { loadConfig } from "../config/env.js";
import { createDatabase } from "../db/client.js";
import { DrizzleKnowledgePersistence } from "../db/persistence.js";
import { ingestMarkdownSource } from "../ingestion/pipeline.js";
import { validateMarkdownPath } from "../ingestion/markdown.js";
import { createLangfuseClient } from "../observability/langfuse.js";
import { createLogger } from "../observability/logger.js";
import { createTelemetry } from "../observability/tracing.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("pke")
    .description("Professional Knowledge Engine CLI")
    .version("0.1.0");

  program
    .command("ingest")
    .description("Ingest a Markdown professional knowledge source")
    .argument("<path>", "Path to a .md or .markdown source file")
    .action(async (sourcePath: string) => {
      const config = loadConfig();
      const logger = createLogger(config.logLevel);
      const telemetry = createTelemetry(config.otelEnabled);
      const langfuse = createLangfuseClient(config.langfuseEnabled);
      const trace = langfuse.trace("markdown-ingestion", { sourcePath });

      try {
        validateMarkdownPath(sourcePath);
        logger.info({ sourcePath }, "ingest.command.start");
        await trace.event("ingest.command.start", { sourcePath });

        const database = createDatabase(config.databaseUrl);
        try {
          const persistence = new DrizzleKnowledgePersistence(database.db);
          const result = await telemetry.runWithSpan("pke.ingest.markdown", async () =>
            ingestMarkdownSource(sourcePath, persistence)
          );

          logger.info(
            {
              sourcePath,
              sourceDocumentId: result.document.source.id,
              evidenceClaims: result.document.evidenceClaims.length
            },
            "ingest.persistence.complete"
          );
          await trace.event("ingest.persistence.complete", {
            sourceDocumentId: result.document.source.id,
            evidenceClaims: result.document.evidenceClaims.length
          });
          console.log(`Ingested ${sourcePath}`);
        } finally {
          await database.close();
          await trace.flush();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ sourcePath, error: message }, "ingest.command.failed");
        await trace.event("ingest.command.failed", { error: message });
        await trace.flush();
        console.error(message);
        process.exitCode = 1;
      }
    });

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildProgram().parseAsync(process.argv);
}
