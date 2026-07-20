import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"

import { EvaluationRuntimeMetadata } from "../../application/ports/runtime-metadata.js"

export class DefaultEvaluationRuntimeMetadata implements EvaluationRuntimeMetadata {
  constructor(private readonly configuredGitSha?: string) {}
  now(): Date { return new Date() }
  nextId(): string { return randomUUID() }
  gitSha(): string {
    if (this.configuredGitSha) return this.configuredGitSha
    try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "unknown" } catch { return "unknown" }
  }
}
