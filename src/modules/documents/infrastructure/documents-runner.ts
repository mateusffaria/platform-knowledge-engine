import { createDatabase } from "../../../shared/database/client.js"
import { AppConfig, loadConfig } from "../../../shared/config/env.js"
import { configureLogger, errorLogFields, logEvent, shutdownLogger } from "../../../shared/logging/logger.js"
import { createLangfuseClient } from "../../../shared/observability/langfuse.js"
import { createTelemetry } from "../../../shared/observability/tracing.js"
import { createPlanResumeContentUseCase } from "../application/use-cases/plan-resume-content.js"
import { ResumePlanningLlmProvider } from "../application/ports/resume-planning-llm-provider.js"
import { LlmResumeContentPlanner } from "../application/services/llm-resume-content-planner.js"
import { LlmProviderFactory } from "../../jobs/infrastructure/llm-providers/llm-provider-factory.js"
import { DrizzleCompatibleCuratedEvidenceReader } from "./repositories/drizzle-compatible-curated-evidence-reader.js"
import { DrizzleResumeContentPlanRepository } from "./repositories/drizzle-resume-content-plan-repository.js"
import { ResumePlanningObservabilityAdapter } from "./observability/resume-planning-observability-adapter.js"

class LazyResumePlanningLlmProvider implements ResumePlanningLlmProvider {
  private provider: ResumePlanningLlmProvider | undefined
  constructor(private readonly config: AppConfig, private readonly factory = new LlmProviderFactory()) {}
  private get(): ResumePlanningLlmProvider { return this.provider ??= this.factory.create(this.config) }
  resolveIdentity(model?: string) { return this.get().resolveIdentity(model) }
  generate(request: Parameters<ResumePlanningLlmProvider["generate"]>[0]) { return this.get().generate(request) }
}

export function createProductionDocumentsServices() {
  const config = loadConfig()
  const database = createDatabase(config.databaseUrl)
  const logger = configureLogger(config)
  const telemetry = createTelemetry({ enabled: config.otelEnabled, endpoint: config.otelExporterOtlpEndpoint, serviceName: config.otelServiceName, sampleRatio: config.otelSampleRatio })
  const langfuse = createLangfuseClient({
    baseUrl: config.langfuseBaseUrl,
    publicKey: config.langfusePublicKey,
    secretKey: config.langfuseSecretKey,
    captureContent: config.langfuseCaptureContent
  }, (operation, error) => logEvent(logger, "observability.langfuse.failed", { component: "langfuse", operation, ...errorLogFields(error) }, "error"))
  const observability = new ResumePlanningObservabilityAdapter(telemetry, langfuse, logger)
  const planRepository = new DrizzleResumeContentPlanRepository(database.db)
  const planner = new LlmResumeContentPlanner(new LazyResumePlanningLlmProvider(config), observability)

  return {
    planResumeContent: createPlanResumeContentUseCase({
      curatedEvidenceReader: new DrizzleCompatibleCuratedEvidenceReader(database.db),
      planRepository,
      planner,
      observability
    }),
    close: async () => {
      try { await telemetry.shutdown() } finally {
        try { await database.close() } finally { await shutdownLogger() }
      }
    }
  }
}
