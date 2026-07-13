import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MissingEmbeddingProviderError } from "../src/modules/retrieval/infrastructure/embedding-providers/missing-embedding-provider-error.js";
import { registerRetrievalCommands } from "../src/modules/retrieval/interfaces/cli/retrieval-commands.js";

function createProgram(createServices: Parameters<typeof registerRetrievalCommands>[1]): Command {
  const program = new Command();
  program.exitOverride();
  registerRetrievalCommands(program, createServices);
  return program;
}

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
});
