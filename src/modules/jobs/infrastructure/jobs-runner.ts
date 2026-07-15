import { createDatabase } from "../../../shared/database/client.js";
import { loadConfig } from "../../../shared/config/env.js";
import { createLangfuseClient } from "../../../shared/observability/langfuse.js";
import { JobAnalyzerAgent } from "../application/services/job-analyzer-agent.js";
import { createAnalyzeJobDescriptionUseCase } from "../application/use-cases/analyze-job-description.js";
import { createBuildJobRetrievalIntentUseCase } from "../application/use-cases/build-job-retrieval-intent.js";
import { createIngestJobDescriptionUseCase } from "../application/use-cases/ingest-job-description.js";
import { createShowJobDescriptionUseCase } from "../application/use-cases/show-job-description.js";
import { DrizzleJobDescriptionRepository } from "./repositories/drizzle-job-description-repository.js";
import { DrizzleJobAnalysisRepository } from "./repositories/drizzle-job-analysis-repository.js";
import { DeterministicJobSourceParser } from "./parsers/deterministic-job-source-parser.js";
import { LlmProviderFactory } from "./llm-providers/llm-provider-factory.js";
import { LangfuseJobAnalysisObservability } from "./observability/langfuse-job-analysis-observability.js";

export function createProductionJobsServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const repository = new DrizzleJobDescriptionRepository(database.db);
  const analysisRepository = new DrizzleJobAnalysisRepository(database.db);
  const observability = new LangfuseJobAnalysisObservability(createLangfuseClient(config.langfuseEnabled));
  const providerFactory = new LlmProviderFactory();
  const jobAnalyzer = {
    analyze: (command: Parameters<JobAnalyzerAgent["analyze"]>[0]) => new JobAnalyzerAgent(
      providerFactory.create(config),
      observability
    ).analyze(command)
  };

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
    buildJobRetrievalIntent: createBuildJobRetrievalIntentUseCase(repository, analysisRepository),
    close: database.close
  };
}
