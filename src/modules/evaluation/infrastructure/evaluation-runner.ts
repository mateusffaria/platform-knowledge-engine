import { createDatabase } from "../../../shared/database/client.js"
import { loadConfig } from "../../../shared/config/env.js"
import { configureLogger, errorLogFields, logEvent, shutdownLogger } from "../../../shared/logging/logger.js"
import { createLangfuseClient } from "../../../shared/observability/langfuse.js"
import { createTelemetry } from "../../../shared/observability/tracing.js"
import { LlmEvidenceReasoner } from "../../jobs/application/services/llm-evidence-reasoner.js"
import { LlmProviderFactory } from "../../jobs/infrastructure/llm-providers/llm-provider-factory.js"
import { createListEvaluationScenariosUseCase } from "../application/use-cases/list-evaluation-scenarios.js"
import { createRunEvaluationUseCase } from "../application/use-cases/run-evaluation.js"
import { createShowEvaluationRunUseCase } from "../application/use-cases/show-evaluation-run.js"
import { FileEvaluationDatasetLoader } from "./datasets/file-evaluation-dataset-loader.js"
import { FixtureEvaluationPipeline } from "./pipeline/fixture-evaluation-pipeline.js"
import { DrizzleEvaluationRepository } from "./repositories/drizzle-evaluation-repository.js"
import { DefaultEvaluationRuntimeMetadata } from "./runtime/default-evaluation-runtime-metadata.js"
import { CompositeEvaluationObservability } from "./observability/composite-evaluation-observability.js"
import { LangfuseEvaluationObservability } from "./observability/langfuse-evaluation-observability.js"
import { OpenTelemetryEvaluationObservability } from "./observability/open-telemetry-evaluation-observability.js"

function optionalReasoner(config: ReturnType<typeof loadConfig>) {
  if (!config.llmProvider || !config.llmModel) return undefined
  const provider = new LlmProviderFactory().create(config)
  return new LlmEvidenceReasoner(provider, {
    trace: () => ({ event: async () => undefined, generation: async () => undefined, flush: async () => undefined })
  })
}

export function createProductionEvaluationServices() {
  const config = loadConfig()
  const database = createDatabase(config.databaseUrl)
  const logger = configureLogger(config)
  const telemetry = createTelemetry({ enabled: config.otelEnabled, endpoint: config.otelExporterOtlpEndpoint, serviceName: config.otelServiceName, sampleRatio: config.otelSampleRatio })
  const langfuse = createLangfuseClient({ baseUrl: config.langfuseBaseUrl, publicKey: config.langfusePublicKey, secretKey: config.langfuseSecretKey, captureContent: config.langfuseCaptureContent }, (operation, error) => logEvent(logger, "observability.langfuse.failed", { component: "langfuse", operation, ...errorLogFields(error) }, "error"))
  const loader = new FileEvaluationDatasetLoader()
  const repository = new DrizzleEvaluationRepository(database.db)
  return {
    listEvaluationScenarios: createListEvaluationScenariosUseCase(loader),
    runEvaluation: createRunEvaluationUseCase({
      datasetLoader: loader,
      pipeline: new FixtureEvaluationPipeline(optionalReasoner(config)),
      repository,
      runtime: new DefaultEvaluationRuntimeMetadata(config.gitSha),
      observability: new CompositeEvaluationObservability([
        new OpenTelemetryEvaluationObservability(telemetry, logger),
        new LangfuseEvaluationObservability(langfuse)
      ])
    }),
    showEvaluationRun: createShowEvaluationRunUseCase(repository),
    close: async () => {
      try { await telemetry.shutdown() }
      finally {
        try { await database.close() }
        finally { await shutdownLogger() }
      }
    }
  }
}
