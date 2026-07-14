import { Command } from "commander";

import {
  EvidenceClaimStatus,
  EvidenceItem,
  EvidencePack,
  HybridSubjectType,
  SearchKnowledgeResult,
  SearchResult
} from "../../application/types.js";
import { PkqlParseError } from "../../application/pkql-parser.js";
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

function reportPkqlParseError(error: unknown): boolean {
  if (!(error instanceof PkqlParseError)) {
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

function parseOptionalClaimStatus(value: string | undefined): EvidenceClaimStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "confirmed" && value !== "single_source") {
    throw new Error("Claim status filter must be confirmed or single_source for trusted retrieval.");
  }

  return value;
}

function parseOptionalSubjectType(value: string | undefined): HybridSubjectType | undefined {
  if (value === undefined) {
    return undefined;
  }

  const allowed = ["knowledge_asset", "evidence_claim", "skill", "experience", "project", "achievement"];
  if (!allowed.includes(value)) {
    throw new Error(`Unsupported subject type filter: ${value}.`);
  }

  return value as HybridSubjectType;
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

function compactEvidenceText(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 180);
}

function sourceLabel(item: EvidenceItem): string {
  const source = item.sources[0];
  if (!source) {
    return "source=unavailable";
  }

  return `source=${source.sourcePath ?? source.sourceDocumentId}${source.locator ? ` ${source.locator}` : ""}`;
}

function printCompactEvidenceItem(item: EvidenceItem, index: number): void {
  const status = item.claimStatus ? ` status=${item.claimStatus}` : "";
  console.log(`${index + 1}. ${item.subjectType} final=${item.finalScore.toFixed(4)}${status} confidence=${item.confidenceScore}`);
  console.log(`   ${compactEvidenceText(item.claimText)}`);
  console.log(`   ${sourceLabel(item)}`);
}

function printVerboseEvidenceItem(item: EvidenceItem, index: number): void {
  console.log(`${index + 1}. ${item.subjectType} final=${item.finalScore.toFixed(4)} strategies=${item.retrievalStrategies.join(",")}`);
  console.log(`   knowledgeAssetId=${item.knowledgeAssetId}`);
  if (item.evidenceClaimId) {
    console.log(`   evidenceClaimId=${item.evidenceClaimId}`);
  }
  if (item.claimType) {
    console.log(`   claimType=${item.claimType}`);
  }
  if (item.claimStatus) {
    console.log(`   claimStatus=${item.claimStatus}`);
  }
  console.log(`   confidenceScore=${item.confidenceScore}`);
  if (item.structuredScore !== undefined) {
    console.log(`   structuredScore=${item.structuredScore.toFixed(4)}`);
  }
  if (item.semanticScore !== undefined) {
    console.log(`   semanticScore=${item.semanticScore.toFixed(4)}`);
  }
  console.log(`   claimText=${compactEvidenceText(item.claimText)}`);
  for (const source of item.sources) {
    console.log(`   sourceReferenceId=${source.id} source=${source.sourcePath ?? source.sourceDocumentId}`);
    console.log(`   excerpt=${compactEvidenceText(source.excerpt)}`);
  }
}

function printEvidencePack(pack: EvidencePack, options: { json?: boolean; verbose?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(pack, null, 2));
    return;
  }

  console.log(`Evidence Pack for "${pack.query}" (${pack.strategies.join(", ")})`);
  if (pack.items.length === 0) {
    console.log(pack.warnings[0] ?? "No relevant eligible evidence was found.");
    return;
  }

  for (const [index, item] of pack.items.entries()) {
    if (options.verbose) {
      printVerboseEvidenceItem(item, index);
    } else {
      printCompactEvidenceItem(item, index);
    }
  }

  for (const warning of pack.warnings) {
    console.log(`Warning: ${warning}`);
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
        if (!reportMissingEmbeddingProvider(error) && !reportPkqlParseError(error)) {
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
        if (!reportMissingEmbeddingProvider(error) && !reportPkqlParseError(error)) {
          throw error;
        }
      } finally {
        await services?.close();
      }
    });

  program
    .command("retrieve")
    .description("Retrieve a ranked Evidence Pack using structured and semantic search")
    .argument("<query>", "PKQL or natural-language retrieval query")
    .option("-l, --limit <number>", "maximum number of evidence items", "10")
    .option("--min-score <number>", "minimum final ranking score")
    .option("--claim-status <status>", "filter trusted evidence by claim status: confirmed or single_source")
    .option("--subject-type <type>", "filter by subject type: knowledge_asset, evidence_claim, skill, experience, project, achievement")
    .option("--verbose", "include identifiers, score components, strategies, and excerpts")
    .option("--json", "print machine-readable JSON")
    .action(async (
      query: string,
      options: {
        limit: string;
        minScore?: string;
        claimStatus?: string;
        subjectType?: string;
        verbose?: boolean;
        json?: boolean;
      }
    ) => {
      const limit = parsePositiveInteger(options.limit, "Retrieval limit");
      const minScore = parseOptionalScore(options.minScore);
      const claimStatus = parseOptionalClaimStatus(options.claimStatus);
      const subjectType = parseOptionalSubjectType(options.subjectType);

      let services: ReturnType<RetrievalServicesFactory> | undefined;
      try {
        services = createServices();
        const result = await services.hybridSearch.execute({
          query,
          limit,
          minScore,
          claimStatus,
          subjectType
        });
        printEvidencePack(result, options);
      } catch (error) {
        if (!reportMissingEmbeddingProvider(error) && !reportPkqlParseError(error)) {
          throw error;
        }
      } finally {
        await services?.close();
      }
    });
}
