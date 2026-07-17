import pino from "pino";
import { trace } from "@opentelemetry/api";

import { AppConfig } from "../config/env.js";

export type Logger = pino.Logger;
export type LogSeverity = "info" | "error";
export type LogFields = Record<string, string | number | boolean | undefined>;
type ManagedTransport = ReturnType<typeof pino.transport> & { ref(): void; unref(): void };

let sharedLogger: Logger | undefined;
let sharedTransport: ManagedTransport | undefined;
let sharedTransportReady: Promise<void> | undefined;

function definedFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function createTransport(config: AppConfig): pino.DestinationStream {
  if (!config.otelEnabled || !config.otelExporterOtlpEndpoint) {
    return pino.destination(2);
  }

  const transport = pino.transport({
    targets: [
      {
        target: "pino/file",
        level: config.logLevel,
        options: { destination: 2 }
      },
      {
        target: "pino-opentelemetry-transport",
        level: config.logLevel,
        options: {
          loggerName: config.otelServiceName,
          serviceVersion: config.appVersion,
          // CLI commands are short-lived. Export each canonical terminal event immediately
          // instead of relying on a batch interval that may outlive the process.
          logRecordProcessorOptions: {
            recordProcessorType: "simple",
            exporterOptions: {
              protocol: "http/protobuf",
              protobufExporterOptions: {
                url: `${config.otelExporterOtlpEndpoint.replace(/\/$/, "")}/v1/logs`
              }
            }
          },
          resourceAttributes: definedFields({
            "service.name": config.otelServiceName,
            "service.version": config.appVersion,
            "deployment.environment.name": config.appEnvironment,
            "vcs.revision": config.gitSha,
            "cloud.region": config.deploymentRegion
          })
        }
      }
    ]
  });
  sharedTransport = transport as ManagedTransport;
  sharedTransportReady = new Promise<void>((resolve, reject) => {
    const onReady = () => {
      transport.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      transport.off("ready", onReady);
      reject(error);
    };
    transport.once("ready", onReady);
    transport.once("error", onError);
  });
  return transport;
}

export function configureLogger(config: AppConfig): Logger {
  if (sharedLogger) return sharedLogger;

  sharedLogger = pino({
    level: config.logLevel,
    base: definedFields({
      service_name: config.otelServiceName,
      service_version: config.appVersion,
      deployment_environment: config.appEnvironment,
      git_sha: config.gitSha,
      deployment_region: config.deploymentRegion
    }),
    redact: {
      paths: ["password", "secret", "token", "authorization", "*.password", "*.secret", "*.token", "*.authorization"],
      censor: "[REDACTED]"
    }
  }, createTransport(config));
  return sharedLogger;
}

/** Flushes and closes the OTLP worker so short-lived CLI commands do not lose their final event. */
export async function shutdownLogger(): Promise<void> {
  const transport = sharedTransport;
  if (!transport) return;

  transport.ref();
  const keepAlive = setInterval(() => undefined, 1_000);
  try {
    await sharedTransportReady;
    await new Promise<void>((resolve, reject) => {
      transport.once("close", resolve);
      transport.once("error", reject);
      transport.flushSync();
      transport.end();
    });
  } finally {
    clearInterval(keepAlive);
    transport.unref();
    sharedTransport = undefined;
    sharedTransportReady = undefined;
    sharedLogger = undefined;
  }
}

export function traceLogFields(fields: LogFields = {}): LogFields {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return {
    ...fields,
    ...(spanContext?.traceId ? {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      trace_flags: spanContext.traceFlags
    } : {})
  };
}

export function errorLogFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      error_type: error.name,
      error_message: error.message,
      error_stack: error.stack
    };
  }
  return { error_type: "NonError", error_message: String(error) };
}

export function logEvent(logger: Logger, eventName: string, fields: LogFields = {}, severity: LogSeverity = "info"): void {
  const event = traceLogFields({ event_name: eventName, ...fields });
  if (severity === "error") {
    logger.error(event, eventName);
    return;
  }
  logger.info(event, eventName);
}
