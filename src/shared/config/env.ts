import "dotenv/config";

export interface AppConfig {
  databaseUrl: string;
  logLevel: string;
  otelEnabled: boolean;
  langfuseEnabled: boolean;
  embeddingProvider?: string;
  embeddingModel?: string;
  ollamaBaseUrl: string;
  semanticSearchMinScore?: number;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readOptionalNumber(name: string): number | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number.`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "postgres://pke:pke@localhost:5432/pke",
    logLevel: process.env.LOG_LEVEL ?? "info",
    otelEnabled: readBoolean("OTEL_ENABLED", false),
    langfuseEnabled: readBoolean("LANGFUSE_ENABLED", false),
    embeddingProvider: process.env.EMBEDDING_PROVIDER || undefined,
    embeddingModel: process.env.EMBEDDING_MODEL || undefined,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    semanticSearchMinScore: readOptionalNumber("SEMANTIC_SEARCH_MIN_SCORE")
  };
}
