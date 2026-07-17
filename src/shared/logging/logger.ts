import pino from "pino";
import { trace } from "@opentelemetry/api";

export type Logger = pino.Logger;

export function createLogger(level: string): Logger {
  return pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

export function traceLogFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return {
    ...fields,
    ...(spanContext?.traceId ? { traceId: spanContext.traceId } : {})
  };
}
