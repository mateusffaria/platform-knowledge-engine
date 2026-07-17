import { createIngestCareerSourceUseCase } from "../application/use-cases/ingest-career-source.js";
import { IngestCommandRunner } from "../interfaces/cli/ingest-command.js";
import { createAssessClaimsUseCase } from "../../reconciliation/application/use-cases/assess-claims.js";
import { DrizzleKnowledgePersistence } from "../../knowledge/infrastructure/repositories/drizzle-knowledge-persistence.js";
import { DrizzleTrustedClaimRepository } from "../../knowledge/infrastructure/repositories/drizzle-trusted-claim-repository.js";
import { loadConfig } from "../../../shared/config/env.js";
import { createDatabase } from "../../../shared/database/client.js";
import { createLogger } from "../../../shared/logging/logger.js";
import { createLangfuseClient } from "../../../shared/observability/langfuse.js";
import { createTelemetry } from "../../../shared/observability/tracing.js";
import { MarkdownCareerDocumentParser } from "./parsers/markdown.js";

export function createProductionIngestMarkdownRunner(): IngestCommandRunner {
  return {
    async run(sourcePath: string): Promise<void> {
      const config = loadConfig();
      const logger = createLogger(config.logLevel);
      const telemetry = createTelemetry({
        enabled: config.otelEnabled,
        endpoint: config.otelExporterOtlpEndpoint,
        serviceName: config.otelServiceName,
        sampleRatio: config.otelSampleRatio
      });
      const langfuse = createLangfuseClient({
        baseUrl: config.langfuseBaseUrl,
        publicKey: config.langfusePublicKey,
        secretKey: config.langfuseSecretKey,
        captureContent: config.langfuseCaptureContent
      });
      const trace = langfuse.trace("markdown-ingestion", { sourcePath });

      try {
        logger.info({ sourcePath }, "ingest.command.start");
        await trace.event("ingest.command.start", { sourcePath });

        const database = createDatabase(config.databaseUrl);
        try {
          const useCase = createIngestCareerSourceUseCase({
            parser: new MarkdownCareerDocumentParser(),
            persistence: new DrizzleKnowledgePersistence(database.db),
            claimAssessment: createAssessClaimsUseCase(new DrizzleTrustedClaimRepository(database.db))
          });
          const result = await telemetry.runWithSpan("pke.ingest.markdown", async () =>
            useCase.execute({ sourcePath })
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
          console.log(result.created ? `Ingested ${sourcePath}` : `Already ingested ${sourcePath}`);
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
    }
  };
}
