export type ResumeGenerationMetric = "generationDuration" | "renderingDuration" | "outputSize" | "pageCount" | "evidenceCount" | "sectionCount" | "failures" | "validationFailures" | "cacheHits"

export interface ResumeGenerationObservability {
  run<T>(name: string, attributes: Record<string, string | number | boolean | undefined>, operation: () => Promise<T>): Promise<T>
  event(name: string, attributes?: Record<string, string | number | boolean | undefined>): void
  record(name: ResumeGenerationMetric, value: number, attributes?: Record<string, string | number | boolean | undefined>): void
}

export class NoopResumeGenerationObservability implements ResumeGenerationObservability {
  async run<T>(_name: string, _attributes: Record<string, string | number | boolean | undefined>, operation: () => Promise<T>): Promise<T> { return operation() }
  event(_name: string, _attributes: Record<string, string | number | boolean | undefined> = {}): void {}
  record(_name: ResumeGenerationMetric, _value: number, _attributes: Record<string, string | number | boolean | undefined> = {}): void {}
}

export class FailOpenResumeGenerationObservability implements ResumeGenerationObservability {
  constructor(private readonly delegate: ResumeGenerationObservability) {}
  async run<T>(name: string, attributes: Record<string, string | number | boolean | undefined>, operation: () => Promise<T>): Promise<T> {
    let operationPromise: Promise<T> | undefined
    try { return await this.delegate.run(name, attributes, () => operationPromise = operation()) } catch (error) {
      if (operationPromise) return operationPromise
      return operation()
    }
  }
  event(name: string, attributes: Record<string, string | number | boolean | undefined> = {}): void { try { this.delegate.event(name, attributes) } catch {} }
  record(name: ResumeGenerationMetric, value: number, attributes: Record<string, string | number | boolean | undefined> = {}): void { try { this.delegate.record(name, value, attributes) } catch {} }
}
