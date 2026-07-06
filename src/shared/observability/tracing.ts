import { trace } from "@opentelemetry/api";

export interface Telemetry {
  runWithSpan<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

export function createTelemetry(enabled: boolean): Telemetry {
  const tracer = trace.getTracer("professional-knowledge-engine");

  return {
    async runWithSpan<T>(name: string, operation: () => Promise<T>): Promise<T> {
      if (!enabled) {
        return operation();
      }

      return tracer.startActiveSpan(name, async (span) => {
        try {
          return await operation();
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      });
    }
  };
}
