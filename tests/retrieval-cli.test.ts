import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchKnowledgeResult } from "../src/modules/retrieval/application/types.js";
import { MissingEmbeddingProviderError } from "../src/modules/retrieval/infrastructure/embedding-providers/missing-embedding-provider-error.js";
import { registerRetrievalCommands } from "../src/modules/retrieval/interfaces/cli/retrieval-commands.js";

function createProgram(createServices: Parameters<typeof registerRetrievalCommands>[1]): Command {
  const program = new Command();
  program.exitOverride();
  registerRetrievalCommands(program, createServices);
  return program;
}

function createSearchServices(result: SearchKnowledgeResult, execute = vi.fn(async () => result)) {
  return {
    indexKnowledge: {
      execute: vi.fn()
    },
    searchKnowledge: {
      execute
    },
    close: vi.fn(async () => undefined)
  };
}

const rankedSearchResult: SearchKnowledgeResult = {
  status: "results",
  query: "retrieval systems",
  limit: 10,
  results: [
    {
      subjectType: "evidence_claim",
      subjectId: "claim-1",
      knowledgeAssetId: "asset-1",
      evidenceClaimId: "claim-1",
      sourceDocumentId: "source-1",
      sourceReferenceId: "reference-1",
      similarityScore: 0.91,
      text: "claim_text: Built a pgvector retrieval service. | source_path: examples/profile.md"
    }
  ]
};

describe("retrieval CLI commands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("reports actionable missing-provider errors for index", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram(() => {
      throw new MissingEmbeddingProviderError("configure Ollama embeddings");
    });

    await program.parseAsync(["node", "pke", "index"]);

    expect(error).toHaveBeenCalledWith("configure Ollama embeddings");
    expect(process.exitCode).toBe(1);
  });

  it("reports actionable missing-provider errors for search", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram(() => {
      throw new MissingEmbeddingProviderError("configure Ollama embeddings");
    });

    await program.parseAsync(["node", "pke", "search", "retrieval systems"]);

    expect(error).toHaveBeenCalledWith("configure Ollama embeddings");
    expect(process.exitCode).toBe(1);
  });

  it("prints compact search output by default", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createSearchServices(rankedSearchResult);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "search", "retrieval systems"]);

    expect(log).toHaveBeenCalledWith("1. evidence_claim similarity=0.9100");
    expect(log).toHaveBeenCalledWith("   claim_text: Built a pgvector retrieval service.");
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("knowledgeAssetId="));
  });

  it("passes limit and min-score options to search policy", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const execute = vi.fn(async () => rankedSearchResult);
    const services = createSearchServices(rankedSearchResult, execute);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "search", "retrieval systems", "--limit", "3", "--min-score", "0.7"]);

    expect(execute).toHaveBeenCalledWith({
      query: "retrieval systems",
      limit: 3,
      minScore: 0.7
    });
    expect(log).toHaveBeenCalled();
  });

  it("prints verbose search metadata when requested", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createSearchServices(rankedSearchResult);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "search", "retrieval systems", "--verbose"]);

    expect(log).toHaveBeenCalledWith("1. evidence_claim claim-1 similarity=0.9100");
    expect(log).toHaveBeenCalledWith("   knowledgeAssetId=asset-1");
    expect(log).toHaveBeenCalledWith("   evidenceClaimId=claim-1");
    expect(log).toHaveBeenCalledWith("   sourceReferenceId=reference-1");
  });

  it("prints JSON search output for machine consumption", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createSearchServices(rankedSearchResult);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "search", "retrieval systems", "--json"]);

    expect(JSON.parse(log.mock.calls[0][0])).toEqual(rankedSearchResult);
  });

  it("prints explicit no-relevant-evidence output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createSearchServices({
      status: "no_relevant_evidence",
      query: "unrelated",
      limit: 10,
      minScore: 0.8,
      bestSimilarityScore: 0.31,
      results: []
    });
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "search", "unrelated", "--min-score", "0.8"]);

    expect(log).toHaveBeenCalledWith('No relevant evidence found for "unrelated" at min-score 0.8. Best similarity was 0.3100.');
  });
});
