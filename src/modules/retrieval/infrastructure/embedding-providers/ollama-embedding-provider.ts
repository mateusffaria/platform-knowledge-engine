import { embeddingDimensions } from "../../../../shared/database/schema.js";
import { EmbeddingProvider } from "../../application/ports/embedding-provider.js";
import { EmbeddingVector } from "../../application/types.js";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

interface OllamaEmbeddingProviderOptions {
  baseUrl: string;
  model: string;
  expectedDimensions?: number;
  fetchImpl?: Fetch;
}

interface OllamaEmbedResponse {
  embeddings?: unknown;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly expectedDimensions: number;
  private readonly fetchImpl: Fetch;

  constructor({
    baseUrl,
    model,
    expectedDimensions = embeddingDimensions,
    fetchImpl = fetch
  }: OllamaEmbeddingProviderOptions) {
    this.endpoint = `${baseUrl.replace(/\/+$/, "")}/api/embed`;
    this.model = model;
    this.expectedDimensions = expectedDimensions;
    this.fetchImpl = fetchImpl;
  }

  async embedDocuments(texts: string[]): Promise<EmbeddingVector[]> {
    const embeddings = await this.requestEmbeddings(texts);
    if (embeddings.length !== texts.length) {
      throw new Error(`Ollama returned ${embeddings.length} embeddings for ${texts.length} document texts.`);
    }

    return embeddings.map((values) => this.toEmbeddingVector(values));
  }

  async embedQuery(text: string): Promise<EmbeddingVector> {
    const embeddings = await this.requestEmbeddings(text);
    if (embeddings.length !== 1) {
      throw new Error(`Ollama returned ${embeddings.length} embeddings for one query text.`);
    }

    return this.toEmbeddingVector(embeddings[0]);
  }

  private async requestEmbeddings(input: string | string[]): Promise<number[][]> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input,
        dimensions: this.expectedDimensions
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed with HTTP ${response.status}: ${await response.text()}`);
    }

    let body: OllamaEmbedResponse;
    try {
      body = await response.json() as OllamaEmbedResponse;
    } catch (error) {
      throw new Error("Ollama embedding response was not valid JSON.", { cause: error });
    }

    return this.parseEmbeddings(body.embeddings);
  }

  private parseEmbeddings(embeddings: unknown): number[][] {
    if (!Array.isArray(embeddings)) {
      throw new Error("Ollama embedding response did not include an embeddings array.");
    }

    return embeddings.map((embedding, index) => this.parseEmbedding(embedding, index));
  }

  private parseEmbedding(embedding: unknown, index: number): number[] {
    if (!Array.isArray(embedding)) {
      throw new Error(`Ollama embedding at index ${index} was not an array.`);
    }
    if (embedding.length === 0) {
      throw new Error(`Ollama embedding at index ${index} was empty.`);
    }

    const values = embedding.map((value, valueIndex) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Ollama embedding at index ${index} contained a non-numeric value at position ${valueIndex}.`);
      }

      return value;
    });

    if (values.length !== this.expectedDimensions) {
      throw new Error(
        `Ollama returned ${values.length}-dimension embeddings but ${this.expectedDimensions} dimensions are required.`
      );
    }

    return values;
  }

  private toEmbeddingVector(values: number[]): EmbeddingVector {
    return {
      provider: "ollama",
      model: this.model,
      dimensions: values.length,
      values
    };
  }
}
