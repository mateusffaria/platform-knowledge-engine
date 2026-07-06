import "dotenv/config";

export interface AppConfig {
  databaseUrl: string;
  logLevel: string;
  otelEnabled: boolean;
  langfuseEnabled: boolean;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "postgres://pke:pke@localhost:5432/pke",
    logLevel: process.env.LOG_LEVEL ?? "info",
    otelEnabled: readBoolean("OTEL_ENABLED", false),
    langfuseEnabled: readBoolean("LANGFUSE_ENABLED", false)
  };
}
