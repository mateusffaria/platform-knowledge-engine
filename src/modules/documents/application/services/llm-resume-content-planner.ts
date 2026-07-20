import { createHash } from "node:crypto"

import { buildResumePlanningUserPrompt, resumePlanningPromptVersion, resumePlanningSystemPrompt } from "../resume-planning-prompt.js"
import { buildResumePlanOutputJsonSchema, parseResumePlanDraft } from "../resume-content-plan-schema.js"
import { ResumeContentPlanner, ResumePlanningCommand, ResumePlanningGeneration, ResumePlanningIdentity } from "../ports/resume-content-planner.js"
import { ResumePlanningLlmProvider } from "../ports/resume-planning-llm-provider.js"
import { FailOpenResumePlanningObservability, NoopResumePlanningObservability, ResumePlanningObservability } from "../ports/resume-planning-observability.js"

const maxAttempts = 2
const recoveryMaxPredict = 8_192

export function buildResumePlanIdentity(input: {
  curatedEvidencePackId: string
  provider: string
  model: string
  promptVersion: string
  language: string
  length: string
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

export class LlmResumeContentPlanner implements ResumeContentPlanner {
  private readonly observability: ResumePlanningObservability

  constructor(private readonly provider: ResumePlanningLlmProvider, observability: ResumePlanningObservability = new NoopResumePlanningObservability()) {
    this.observability = new FailOpenResumePlanningObservability(observability)
  }

  getIdentity(command: ResumePlanningCommand): ResumePlanningIdentity {
    const identity = this.provider.resolveIdentity(command.model)
    return {
      ...identity,
      promptVersion: resumePlanningPromptVersion,
      planIdentity: buildResumePlanIdentity({
        curatedEvidencePackId: command.input.curatedEvidencePack.id,
        provider: identity.provider,
        model: identity.model,
        promptVersion: resumePlanningPromptVersion,
        language: command.language,
        length: command.length
      })
    }
  }

  async plan(command: ResumePlanningCommand): Promise<ResumePlanningGeneration> {
    const identity = this.getIdentity(command)
    const attributes = { provider: identity.provider, model: identity.model, prompt_version: identity.promptVersion, language: command.language, length: command.length }
    const payload = await this.observability.run("prompt_construction", attributes, () => ({
      systemPrompt: resumePlanningSystemPrompt,
      userPrompt: buildResumePlanningUserPrompt(command.input, command.language, command.length, command.repair),
      model: command.model,
      responseFormat: buildResumePlanOutputJsonSchema(command.input, command.repair),
      disableThinking: true
    }))

    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = performance.now()
      try {
        const generated = await this.observability.run("llm_inference", { ...attributes, attempt }, () => this.provider.generate({
          ...payload,
          ...(attempt === maxAttempts ? { maxPredict: recoveryMaxPredict } : {})
        }))
        if (generated.finishReason === "length") throw new Error("Resume planner output was truncated by the provider.")
        this.observability.record("inferenceDuration", performance.now() - startedAt, attributes)
        if (generated.usage?.promptTokens !== undefined) this.observability.record("promptTokens", generated.usage.promptTokens, attributes)
        if (generated.usage?.completionTokens !== undefined) this.observability.record("completionTokens", generated.usage.completionTokens, attributes)
        const draft = await this.observability.run("schema_validation", { ...attributes, attempt }, () => parseResumePlanDraft(generated.content))
        return { draft, provider: generated.provider, model: generated.model, usage: generated.usage }
      } catch (error) {
        lastError = error
        const retryable = error instanceof Error && (error.message === "Resume planner output was truncated by the provider." || !("diagnostic" in error))
        if (!retryable || attempt === maxAttempts) throw error
      }
    }
    throw lastError
  }
}
