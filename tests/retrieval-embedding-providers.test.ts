import { describe, expect, it } from "vitest";

import { AppConfig } from "../src/shared/config/env.js";
import { EmbeddingProviderFactory } from "../src/modules/retrieval/infrastructure/embedding-providers/embedding-provider-factory.js";
import { MissingEmbeddingProviderError } from "../src/modules/retrieval/infrastructure/embedding-providers/missing-embedding-provider-error.js";
import { OllamaEmbeddingProvider } from "../src/modules/retrieval/infrastructure/embedding-providers/ollama-embedding-provider.js";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    databaseUrl: "postgres://pke:pke@localhost:5432/pke",
    logLevel: "info",
    otelEnabled: false,
    langfuseEnabled: false,
    ollamaBaseUrl: "http://localhost:11434",
    ...overrides
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("EmbeddingProviderFactory", () => {
  it("fails clearly when no embedding provider is configured", () => {
    const factory = new EmbeddingProviderFactory();

    expect(() => factory.create(config())).toThrow(MissingEmbeddingProviderError);
    expect(() => factory.create(config())).toThrow("EMBEDDING_PROVIDER=ollama");
  });

  it("rejects unsupported embedding providers", () => {
    const factory = new EmbeddingProviderFactory();

    expect(() => factory.create(config({ embeddingProvider: "openai", embeddingModel: "text-embedding-3-small" })))
      .toThrow('Unsupported embedding provider "openai"');
  });

  it("fails clearly when Ollama is selected without a model", () => {
    const factory = new EmbeddingProviderFactory();

    expect(() => factory.create(config({ embeddingProvider: "ollama" }))).toThrow(MissingEmbeddingProviderError);
    expect(() => factory.create(config({ embeddingProvider: "ollama" }))).toThrow("EMBEDDING_MODEL is required");
  });

  it("selects Ollama when Ollama embedding configuration is complete", () => {
    const factory = new EmbeddingProviderFactory();

    const provider = factory.create(config({
      embeddingProvider: "ollama",
      embeddingModel: "nomic-embed-text"
    }));

    expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
  });
});

describe("OllamaEmbeddingProvider", () => {
  it("embeds document texts through the configured Ollama endpoint", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const provider = new OllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434/",
      model: "nomic-embed-text",
      expectedDimensions: 3,
      fetchImpl: async (url, init) => {
        requests.push({ url, body: JSON.parse(init?.body as string) });
        return jsonResponse({
          embeddings: [
            [1, 0, 0],
            [0, 1, 0]
          ]
        });
      }
    });

    const embeddings = await provider.embedDocuments(["first", "second"]);

    expect(requests).toEqual([
      {
        url: "http://localhost:11434/api/embed",
        body: {
          model: "nomic-embed-text",
          input: ["first", "second"],
          dimensions: 3
        }
      }
    ]);
    expect(embeddings).toEqual([
      { provider: "ollama", model: "nomic-embed-text", dimensions: 3, values: [1, 0, 0] },
      { provider: "ollama", model: "nomic-embed-text", dimensions: 3, values: [0, 1, 0] }
    ]);
  });

  it("embeds query text through the configured Ollama endpoint", async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      expectedDimensions: 3,
      fetchImpl: async () => jsonResponse({ embeddings: [[0, 0, 1]] })
    });

    await expect(provider.embedQuery("retrieval systems")).resolves.toEqual({
      provider: "ollama",
      model: "nomic-embed-text",
      dimensions: 3,
      values: [0, 0, 1]
    });
  });

  it("fails on HTTP errors", async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      expectedDimensions: 3,
      fetchImpl: async () => new Response("model not found", { status: 404 })
    });

    await expect(provider.embedQuery("retrieval systems")).rejects.toThrow("HTTP 404");
  });

  it("fails on malformed provider responses", async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      expectedDimensions: 3,
      fetchImpl: async () => jsonResponse({ embedding: [1, 0, 0] })
    });

    await expect(provider.embedQuery("retrieval systems")).rejects.toThrow("embeddings array");
  });

  it("fails when document embedding count does not match input count", async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      expectedDimensions: 3,
      fetchImpl: async () => jsonResponse({ embeddings: [[1, 0, 0]] })
    });

    await expect(provider.embedDocuments(["first", "second"])).rejects.toThrow("1 embeddings for 2 document texts");
  });

  it("fails when provider dimensions do not match storage dimensions", async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      expectedDimensions: 3,
      fetchImpl: async () => jsonResponse({ embeddings: [[1, 0]] })
    });

    await expect(provider.embedQuery("retrieval systems")).rejects.toThrow("2-dimension embeddings");
  });
});
