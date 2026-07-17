import { createDatabase } from "../../../shared/database/client.js";
import { loadConfig } from "../../../shared/config/env.js";
import { configureLogger, errorLogFields, logEvent, shutdownLogger } from "../../../shared/logging/logger.js";
import { createLangfuseClient } from "../../../shared/observability/langfuse.js";
import { createTelemetry } from "../../../shared/observability/tracing.js";
import { JobAnalyzerAgent } from "../application/services/job-analyzer-agent.js";
import { LlmEvidenceReasoner } from "../application/services/llm-evidence-reasoner.js";
import { buildCandidateEvidencePack } from "../application/candidate-evidence-pack.js";
import { createAnalyzeJobDescriptionUseCase } from "../application/use-cases/analyze-job-description.js";
import { createBuildJobRetrievalIntentUseCase } from "../application/use-cases/build-job-retrieval-intent.js";
import { createIngestJobDescriptionUseCase } from "../application/use-cases/ingest-job-description.js";
import { createShowJobDescriptionUseCase } from "../application/use-cases/show-job-description.js";
import { createReasonJobEvidenceUseCase } from "../application/use-cases/reason-job-evidence.js";
import { DrizzleJobDescriptionRepository } from "./repositories/drizzle-job-description-repository.js";
import { DrizzleJobAnalysisRepository } from "./repositories/drizzle-job-analysis-repository.js";
import { DrizzleCuratedEvidencePackRepository } from "./repositories/drizzle-curated-evidence-pack-repository.js";
import { DeterministicJobSourceParser } from "./parsers/deterministic-job-source-parser.js";
import { LlmProviderFactory } from "./llm-providers/llm-provider-factory.js";
import { LangfuseJobAnalysisObservability } from "./observability/langfuse-job-analysis-observability.js";
import { LangfuseEvidenceReasoningObservability } from "./observability/langfuse-evidence-reasoning-observability.js";
import { OpenTelemetryReasoningWorkflowTelemetry } from "./observability/open-telemetry-reasoning-workflow-telemetry.js";

export function createProductionJobsServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const repository = new DrizzleJobDescriptionRepository(database.db);
  const analysisRepository = new DrizzleJobAnalysisRepository(database.db);
  const curatedEvidencePackRepository = new DrizzleCuratedEvidencePackRepository(database.db);
  const logger = configureLogger(config);
  const telemetry = createTelemetry({ enabled: config.otelEnabled, endpoint: config.otelExporterOtlpEndpoint, serviceName: config.otelServiceName, sampleRatio: config.otelSampleRatio });
  const langfuse = createLangfuseClient({
    baseUrl: config.langfuseBaseUrl,
    publicKey: config.langfusePublicKey,
    secretKey: config.langfuseSecretKey,
    captureContent: config.langfuseCaptureContent
  }, (operation, error) => logEvent(logger, "observability.langfuse.failed", {
    component: "langfuse",
    operation,
    ...errorLogFields(error)
  }, "error"));
  const observability = new LangfuseJobAnalysisObservability(langfuse);
  const providerFactory = new LlmProviderFactory();
  const provider = providerFactory.create(config);
  const jobAnalyzer = new JobAnalyzerAgent(provider, observability);
  const reasoningTelemetry = new OpenTelemetryReasoningWorkflowTelemetry(telemetry, logger);
  const evidenceReasoner = new LlmEvidenceReasoner(provider, new LangfuseEvidenceReasoningObservability(langfuse), reasoningTelemetry);

  return {
    ingestJobDescription: createIngestJobDescriptionUseCase({
      parser: new DeterministicJobSourceParser(),
      repository
    }),
    showJobDescription: createShowJobDescriptionUseCase(repository),
    analyzeJobDescription: createAnalyzeJobDescriptionUseCase({
      jobDescriptionRepository: repository,
      jobAnalysisRepository: analysisRepository,
      jobAnalyzer
    }),
    reasonJobEvidence: createReasonJobEvidenceUseCase({
      jobDescriptionRepository: repository,
      jobAnalysisRepository: analysisRepository,
      candidateEvidencePackBuilder: { build: buildCandidateEvidencePack },
      curatedEvidencePackRepository,
      evidenceReasoner,
      telemetry: reasoningTelemetry
    }),
    buildJobRetrievalIntent: createBuildJobRetrievalIntentUseCase(repository, analysisRepository),
    close: async () => {
      try {
        await telemetry.shutdown();
      } finally {
        try {
          await database.close();
        } finally {
          await shutdownLogger();
        }
      }
    }
  };
}
