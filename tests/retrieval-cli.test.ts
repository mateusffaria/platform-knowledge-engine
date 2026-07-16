import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PkqlParseError } from "../src/modules/retrieval/application/pkql-parser.js";
import { EvidencePack, SearchKnowledgeResult } from "../src/modules/retrieval/application/types.js";
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
    hybridSearch: {
      execute: vi.fn()
    },
    close: vi.fn(async () => undefined)
  };
}

function createHybridServices(result: EvidencePack, execute = vi.fn(async () => result)) {
  return {
    indexKnowledge: {
      execute: vi.fn()
    },
    searchKnowledge: {
      execute: vi.fn()
    },
    hybridSearch: {
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

const evidencePack: EvidencePack = {
  query: "TypeScript evidence",
  strategies: ["structured", "semantic"],
  generatedAt: new Date("2026-07-14T12:00:00.000Z"),
  warnings: [],
  items: [
    {
      evidenceClaimId: "claim-1",
      knowledgeAssetId: "asset-1",
      subjectType: "skill",
      claimType: "skill",
      claimText: "TypeScript",
      claimStatus: "confirmed",
      confidenceScore: 90,
      structuredScore: 1,
      semanticScore: 0.82,
      finalScore: 1.107,
      sources: [{
        id: "reference-1",
        sourceDocumentId: "source-1",
        section: "Skills",
        locator: "line:1",
        excerpt: "TypeScript",
        sourcePath: "examples/profile.md"
      }],
      retrievalStrategies: ["structured", "semantic"]
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

  it("reports actionable PKQL validation errors for retrieve", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const execute = vi.fn(async () => {
      throw new PkqlParseError('Unsupported PKQL filter "team". Supported filters: company, role, technology, skill, project, status, after, before, type.');
    });
    const services = createHybridServices(evidencePack, execute);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "retrieve", "team:Platform"]);

    expect(error).toHaveBeenCalledWith(
      'Unsupported PKQL filter "team". Supported filters: company, role, technology, skill, project, status, after, before, type.'
    );
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

  it("forces indexing when requested", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createSearchServices(rankedSearchResult);
    services.indexKnowledge.execute.mockResolvedValue({ indexed: 2, skipped: 0 });
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "index", "--force"]);

    expect(services.indexKnowledge.execute).toHaveBeenCalledWith({ force: true });
    expect(log).toHaveBeenCalledWith("Indexed 2 embeddings; skipped 0 unchanged embeddings.");
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

  it("passes retrieve options to hybrid search", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const execute = vi.fn(async () => evidencePack);
    const services = createHybridServices(evidencePack, execute);
    const program = createProgram(() => services);

    await program.parseAsync([
      "node",
      "pke",
      "retrieve",
      "TypeScript evidence",
      "--limit",
      "3",
      "--min-score",
      "0.7",
      "--claim-status",
      "confirmed",
      "--subject-type",
      "skill"
    ]);

    expect(execute).toHaveBeenCalledWith({
      query: "TypeScript evidence",
      limit: 3,
      minScore: 0.7,
      claimStatus: "confirmed",
      subjectType: "skill"
    });
    expect(log).toHaveBeenCalledWith('Evidence Pack for "TypeScript evidence" (structured, semantic)');
  });

  it("prints verbose retrieve metadata when requested", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createHybridServices(evidencePack);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "retrieve", "TypeScript evidence", "--verbose"]);

    expect(log).toHaveBeenCalledWith("1. skill final=1.1070 strategies=structured,semantic");
    expect(log).toHaveBeenCalledWith("   knowledgeAssetId=asset-1");
    expect(log).toHaveBeenCalledWith("   evidenceClaimId=claim-1");
    expect(log).toHaveBeenCalledWith("   structuredScore=1.0000");
    expect(log).toHaveBeenCalledWith("   semanticScore=0.8200");
  });

  it("prints JSON retrieve output for machine consumption", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createHybridServices(evidencePack);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "retrieve", "TypeScript evidence", "--json"]);

    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      ...evidencePack,
      generatedAt: "2026-07-14T12:00:00.000Z"
    });
  });

  it("rejects ineligible retrieve claim-status filters", async () => {
    const services = createHybridServices(evidencePack);
    const program = createProgram(() => services);

    await expect(program.parseAsync(["node", "pke", "retrieve", "TypeScript evidence", "--claim-status", "rejected"]))
      .rejects.toThrow("Claim status filter must be confirmed or single_source for trusted retrieval.");
  });

  it("preserves existing search behavior while retrieve is registered", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const services = createHybridServices(evidencePack);
    services.searchKnowledge.execute.mockResolvedValue(rankedSearchResult);
    const program = createProgram(() => services);

    await program.parseAsync(["node", "pke", "search", "retrieval systems"]);

    expect(services.hybridSearch.execute).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("1. evidence_claim similarity=0.9100");
  });
});
