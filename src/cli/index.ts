#!/usr/bin/env node
import { Command } from "commander";

import { createProductionIngestMarkdownRunner } from "../modules/ingestion/infrastructure/ingest-markdown-runner.js";
import { registerIngestCommand } from "../modules/ingestion/interfaces/cli/ingest-command.js";
import { createProductionJobsServices } from "../modules/jobs/infrastructure/jobs-runner.js";
import { registerJobsCommands } from "../modules/jobs/interfaces/cli/jobs-command.js";
import { registerClaimsCommands } from "../modules/reconciliation/interfaces/cli/claims-command.js";
import { createProductionRetrievalServices } from "../modules/retrieval/infrastructure/retrieval-runner.js";
import { registerRetrievalCommands } from "../modules/retrieval/interfaces/cli/retrieval-commands.js";
import { registerEvaluationCommands } from "../modules/evaluation/interfaces/cli/evaluation-command.js";
import { registerDocumentsCommands } from "../modules/documents/interfaces/cli/documents-command.js";
import { createProductionClaimReviewServices } from "../shared/composition/reconciliation-services.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("pke")
    .description("Professional Knowledge Engine CLI")
    .version("0.1.0");

  registerIngestCommand(program, createProductionIngestMarkdownRunner());
  registerClaimsCommands(program, createProductionClaimReviewServices);
  registerJobsCommands(program, createProductionJobsServices, createProductionRetrievalServices);
  registerRetrievalCommands(program);
  registerEvaluationCommands(program);
  registerDocumentsCommands(program);

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildProgram().parseAsync(process.argv);
}
