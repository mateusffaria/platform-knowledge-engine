import { Langfuse } from "langfuse";

export interface LangfuseTrace {
  event(name: string, properties?: Record<string, unknown>): Promise<void>;
  generation(properties: { name: string; model?: string; metadata?: Record<string, unknown>; usage?: { promptTokens?: number; completionTokens?: number } }): Promise<void>;
  flush(): Promise<void>;
}

export interface LangfuseClient {
  trace(name: string, properties?: Record<string, unknown>): LangfuseTrace;
}

export interface LangfuseOptions {
  baseUrl?: string;
  publicKey?: string;
  secretKey?: string;
  captureContent: boolean;
}

class NoopLangfuseTrace implements LangfuseTrace {
  async event(_name: string, _properties?: Record<string, unknown>): Promise<void> {}
  async generation(_properties: { name: string; model?: string; metadata?: Record<string, unknown>; usage?: { promptTokens?: number; completionTokens?: number } }): Promise<void> {}
  async flush(): Promise<void> {}
}

class NoopLangfuseClient implements LangfuseClient {
  trace(_name: string, _properties?: Record<string, unknown>): LangfuseTrace { return new NoopLangfuseTrace(); }
}

class ConfiguredLangfuseTrace implements LangfuseTrace {
  constructor(private readonly client: Langfuse, private readonly trace: ReturnType<Langfuse["trace"]>) {}

  async event(name: string, properties: Record<string, unknown> = {}): Promise<void> {
    try { this.trace.event({ name, metadata: properties }); } catch {}
  }

  async generation(properties: { name: string; model?: string; metadata?: Record<string, unknown>; usage?: { promptTokens?: number; completionTokens?: number } }): Promise<void> {
    try {
      this.trace.generation({
        name: properties.name,
        model: properties.model,
        metadata: properties.metadata,
        usageDetails: Object.fromEntries([
          ["input", properties.usage?.promptTokens],
          ["output", properties.usage?.completionTokens]
        ].filter((entry): entry is [string, number] => typeof entry[1] === "number"))
      });
    } catch {}
  }

  async flush(): Promise<void> { try { await this.client.flushAsync(); } catch {} }
}

class ConfiguredLangfuseClient implements LangfuseClient {
  constructor(private readonly client: Langfuse) {}

  trace(name: string, properties: Record<string, unknown> = {}): LangfuseTrace {
    try { return new ConfiguredLangfuseTrace(this.client, this.client.trace({ name, metadata: properties })); } catch { return new NoopLangfuseTrace(); }
  }
}

export function createLangfuseClient(options: LangfuseOptions): LangfuseClient {
  if (!options.publicKey || !options.secretKey) return new NoopLangfuseClient();
  try {
    return new ConfiguredLangfuseClient(new Langfuse({
      publicKey: options.publicKey,
      secretKey: options.secretKey,
      baseUrl: options.baseUrl
    }));
  } catch { return new NoopLangfuseClient(); }
}
