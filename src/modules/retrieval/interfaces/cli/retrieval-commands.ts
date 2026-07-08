import { Command } from "commander";

import { createProductionRetrievalServices } from "../../infrastructure/retrieval-runner.js";

type RetrievalServicesFactory = typeof createProductionRetrievalServices;

export function registerRetrievalCommands(
  program: Command,
  createServices: RetrievalServicesFactory = createProductionRetrievalServices
): void {
  program
    .command("index")
    .description("Index persisted professional knowledge for semantic retrieval")
    .action(async () => {
      const services = createServices();
      try {
        const result = await services.indexKnowledge.execute();
        console.log(`Indexed ${result.indexed} embeddings; skipped ${result.skipped} unchanged embeddings.`);
      } finally {
        await services.close();
      }
    });

  program
    .command("search")
    .description("Search indexed professional knowledge")
    .argument("<query>", "semantic search query")
    .option("-l, --limit <number>", "maximum number of results", "10")
    .action(async (query: string, options: { limit: string }) => {
      const limit = Number.parseInt(options.limit, 10);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("Search limit must be a positive integer.");
      }

      const services = createServices();
      try {
        const results = await services.searchKnowledge.execute({ query, limit });
        if (results.length === 0) {
          console.log("No semantic search results found.");
          return;
        }

        for (const [index, result] of results.entries()) {
          console.log(`${index + 1}. ${result.subjectType} ${result.subjectId} score=${result.score.toFixed(4)}`);
          console.log(`   knowledgeAssetId=${result.knowledgeAssetId}`);
          if (result.evidenceClaimId) {
            console.log(`   evidenceClaimId=${result.evidenceClaimId}`);
          }
          if (result.sourceReferenceId) {
            console.log(`   sourceReferenceId=${result.sourceReferenceId}`);
          }
          console.log(`   ${result.text.split("\n").join(" | ")}`);
        }
      } finally {
        await services.close();
      }
    });
}
