export type ResumePlanningMetric = "commandDuration" | "inferenceDuration" | "promptTokens" | "completionTokens" | "validationFailures" | "cacheHits"

export interface ResumePlanningTrace {
  event(name: string, attributes?: Record<string, string | number | boolean | undefined>): Promise<void>
  generation?(input: { name: string; model: string; metadata: Record<string, unknown>; usage?: { promptTokens?: number; completionTokens?: number } }): Promise<void>
  flush(): Promise<void>
}

export interface ResumePlanningObservability {
  trace(name: string, attributes: Record<string, string | number | boolean | undefined>): ResumePlanningTrace
  run<T>(stage: string, attributes: Record<string, string | number | boolean | undefined>, action: () => Promise<T> | T): Promise<T>
  record(metric: ResumePlanningMetric, value: number, attributes: Record<string, string>): void
}

const noopTrace: ResumePlanningTrace = {
  async event() {},
  async flush() {}
}

export class NoopResumePlanningObservability implements ResumePlanningObservability {
  trace(): ResumePlanningTrace { return noopTrace }
  async run<T>(_stage: string, _attributes: Record<string, string | number | boolean | undefined>, action: () => Promise<T> | T): Promise<T> { return action() }
  record(): void {}
}

export class FailOpenResumePlanningObservability implements ResumePlanningObservability {
  constructor(private readonly delegate: ResumePlanningObservability) {}

  trace(name: string, attributes: Record<string, string | number | boolean | undefined>): ResumePlanningTrace {
    let delegate: ResumePlanningTrace
    try { delegate = this.delegate.trace(name, attributes) } catch { return noopTrace }
    return {
      async event(eventName, eventAttributes) { try { await delegate.event(eventName, eventAttributes) } catch {} },
      async generation(input) { try { await delegate.generation?.(input) } catch {} },
      async flush() { try { await delegate.flush() } catch {} }
    }
  }

  async run<T>(stage: string, attributes: Record<string, string | number | boolean | undefined>, action: () => Promise<T> | T): Promise<T> {
    let invoked = false
    let result: T | undefined
    let actionError: unknown
    const wrapped = async () => {
      invoked = true
      try { result = await action(); return result } catch (error) { actionError = error; throw error }
    }
    try { return await this.delegate.run(stage, attributes, wrapped) } catch (error) {
      if (actionError !== undefined) throw actionError
      if (invoked) return result as T
      return action()
    }
  }

  record(metric: ResumePlanningMetric, value: number, attributes: Record<string, string>): void {
    try { this.delegate.record(metric, value, attributes) } catch {}
  }
}
