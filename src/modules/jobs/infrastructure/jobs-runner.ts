import { createDatabase } from "../../../shared/database/client.js";
import { loadConfig } from "../../../shared/config/env.js";
import { createBuildJobRetrievalIntentUseCase } from "../application/use-cases/build-job-retrieval-intent.js";
import { createIngestJobDescriptionUseCase } from "../application/use-cases/ingest-job-description.js";
import { createShowJobDescriptionUseCase } from "../application/use-cases/show-job-description.js";
import { DrizzleJobDescriptionRepository } from "./repositories/drizzle-job-description-repository.js";
import { DeterministicJobSourceParser } from "./parsers/deterministic-job-source-parser.js";

export function createProductionJobsServices() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const repository = new DrizzleJobDescriptionRepository(database.db);

  return {
    ingestJobDescription: createIngestJobDescriptionUseCase({
      parser: new DeterministicJobSourceParser(),
      repository
    }),
    showJobDescription: createShowJobDescriptionUseCase(repository),
    buildJobRetrievalIntent: createBuildJobRetrievalIntentUseCase(repository),
    close: database.close
  };
}
