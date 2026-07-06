export interface LangfuseTrace {
  event(name: string, properties?: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}

export interface LangfuseClient {
  trace(name: string, properties?: Record<string, unknown>): LangfuseTrace;
}

class NoopLangfuseTrace implements LangfuseTrace {
  async event(_name: string, _properties?: Record<string, unknown>): Promise<void> {
    return undefined;
  }

  async flush(): Promise<void> {
    return undefined;
  }
}

class NoopLangfuseClient implements LangfuseClient {
  trace(_name: string, _properties?: Record<string, unknown>): LangfuseTrace {
    return new NoopLangfuseTrace();
  }
}

export function createLangfuseClient(_enabled: boolean): LangfuseClient {
  return new NoopLangfuseClient();
}
