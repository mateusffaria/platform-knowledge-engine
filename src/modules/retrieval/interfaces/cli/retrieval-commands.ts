import { Command } from "commander";

import { SearchKnowledgeResult, SearchResult } from "../../application/types.js";
import { MissingEmbeddingProviderError } from "../../infrastructure/embedding-providers/missing-embedding-provider-error.js";
import { createProductionRetrievalServices } from "../../infrastructure/retrieval-runner.js";

type RetrievalServicesFactory = typeof createProductionRetrievalServices;

function reportMissingEmbeddingProvider(error: unknown): boolean {
  if (!(error instanceof MissingEmbeddingProviderError)) {
    return false;
  }

  console.error(error.message);
  process.exitCode = 1;
  return true;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseOptionalScore(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Minimum score must be a finite number.");
  }

  return parsed;
}

function compactText(text: string): string {
  const claimText = text
    .split(/\n|\s+\|\s+/)
    .find((part) => part.startsWith("claim_text: ") || part.startsWith("title: ") || part.startsWith("summary: "));

  return (claimText ?? text).replace(/\s+/g, " ").slice(0, 180);
}

function printCompactResult(result: SearchResult, index: number): void {
  console.log(`${index + 1}. ${result.subjectType} similarity=${result.similarityScore.toFixed(4)}`);
  console.log(`   ${compactText(result.text)}`);
}

function printVerboseResult(result: SearchResult, index: number): void {
  console.log(`${index + 1}. ${result.subjectType} ${result.subjectId} similarity=${result.similarityScore.toFixed(4)}`);
  console.log(`   knowledgeAssetId=${result.knowledgeAssetId}`);
  if (result.evidenceClaimId) {
    console.log(`   evidenceClaimId=${result.evidenceClaimId}`);
  }
  if (result.sourceReferenceId) {
    console.log(`   sourceReferenceId=${result.sourceReferenceId}`);
  }
  console.log(`   ${result.text.split("\n").join(" | ")}`);
}

function printSearchResult(result: SearchKnowledgeResult, options: { json?: boolean; verbose?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.status === "no_relevant_evidence") {
    const best = result.bestSimilarityScore === undefined
      ? "No matches were returned by the vector store."
      : `Best similarity was ${result.bestSimilarityScore.toFixed(4)}.`;
    console.log(`No relevant evidence found for "${result.query}" at min-score ${result.minScore}. ${best}`);
    return;
  }

  if (result.results.length === 0) {
    console.log("No semantic search results found.");
    return;
  }

  for (const [index, searchResult] of result.results.entries()) {
    if (options.verbose) {
      printVerboseResult(searchResult, index);
    } else {
      printCompactResult(searchResult, index);
    }
  }
}

export function registerRetrievalCommands(
  program: Command,
  createServices: RetrievalServicesFactory = createProductionRetrievalServices
): void {
  program
    .command("index")
    .description("Index persisted professional knowledge for semantic retrieval")
    .action(async () => {
      let services: ReturnType<RetrievalServicesFactory> | undefined;
      try {
        services = createServices();
        const result = await services.indexKnowledge.execute();
        console.log(`Indexed ${result.indexed} embeddings; skipped ${result.skipped} unchanged embeddings.`);
      } catch (error) {
        if (!reportMissingEmbeddingProvider(error)) {
          throw error;
        }
      } finally {
        await services?.close();
      }
    });

  program
    .command("search")
    .description("Search indexed professional knowledge")
    .argument("<query>", "semantic search query")
    .option("-l, --limit <number>", "maximum number of results", "10")
    .option("--min-score <number>", "minimum similarity score for relevant evidence")
    .option("--verbose", "include identifiers and full embedding text")
    .option("--json", "print machine-readable JSON")
    .action(async (query: string, options: { limit: string; minScore?: string; verbose?: boolean; json?: boolean }) => {
      const limit = parsePositiveInteger(options.limit, "Search limit");
      const minScore = parseOptionalScore(options.minScore);

      let services: ReturnType<RetrievalServicesFactory> | undefined;
      try {
        services = createServices();
        const result = await services.searchKnowledge.execute({ query, limit, minScore });
        printSearchResult(result, options);
      } catch (error) {
        if (!reportMissingEmbeddingProvider(error)) {
          throw error;
        }
      } finally {
        await services?.close();
      }
    });
}
