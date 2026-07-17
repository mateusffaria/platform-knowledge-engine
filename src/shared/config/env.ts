import "dotenv/config";

export interface AppConfig {
  databaseUrl: string;
  logLevel: string;
  otelEnabled: boolean;
  otelExporterOtlpEndpoint?: string;
  otelServiceName: string;
  otelSampleRatio: number;
  langfuseBaseUrl?: string;
  langfusePublicKey?: string;
  langfuseSecretKey?: string;
  langfuseCaptureContent: boolean;
  embeddingProvider?: string;
  embeddingModel?: string;
  llmProvider?: string;
  llmModel?: string;
  ollamaBaseUrl: string;
  ollamaMaxPredict?: number;
  reasoningCandidateLimit: number;
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

function readRatio(name: string, fallback: number): number {
  const value = readOptionalNumber(name);
  if (value === undefined) return fallback;
  if (value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = readOptionalNumber(name);
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "postgres://pke:pke@localhost:5432/pke",
    logLevel: process.env.LOG_LEVEL ?? "info",
    otelEnabled: readBoolean("OTEL_ENABLED", false),
    otelExporterOtlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
    otelServiceName: process.env.OTEL_SERVICE_NAME ?? "professional-knowledge-engine",
    otelSampleRatio: readRatio("OTEL_SAMPLE_RATIO", 1),
    langfuseBaseUrl: process.env.LANGFUSE_BASE_URL || undefined,
    langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY || undefined,
    langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY || undefined,
    langfuseCaptureContent: readBoolean("LANGFUSE_CAPTURE_CONTENT", false),
    embeddingProvider: process.env.EMBEDDING_PROVIDER || undefined,
    embeddingModel: process.env.EMBEDDING_MODEL || undefined,
    llmProvider: process.env.LLM_PROVIDER || undefined,
    llmModel: process.env.LLM_MODEL || undefined,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaMaxPredict: readPositiveInteger("OLLAMA_MAX_PREDICT", 4096),
    reasoningCandidateLimit: readPositiveInteger("REASONING_CANDIDATE_LIMIT", 3),
    semanticSearchMinScore: readOptionalNumber("SEMANTIC_SEARCH_MIN_SCORE")
  };
}
