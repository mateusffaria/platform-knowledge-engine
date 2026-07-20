export interface EvaluationRuntimeMetadata {
  now(): Date
  nextId(): string
  gitSha(): string
}
