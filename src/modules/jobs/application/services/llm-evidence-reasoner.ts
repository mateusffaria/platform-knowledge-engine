import { createHash, randomUUID } from "node:crypto";

import { CandidateEvidencePack, CuratedEvidencePack, DegradedEvidenceReasoningResult, EvidenceReasoningResult, RequirementCoverage } from "../../domain/model.js";
import { finalizeCuratedEvidencePack, missingCoverage } from "../evidence-curation.js";
import { buildEvidenceReasoningUserPrompt, evidenceReasoningPromptVersion, evidenceReasoningSystemPrompt } from "../evidence-reasoning-prompt.js";
import { describeEvidenceReasoningValidationError, evidenceReasoningOutputJsonSchema, parseEvidenceReasoningOutput, type EvidenceReasoningValidationDiagnostic } from "../evidence-reasoning-schema.js";
import { EvidenceReasoner, EvidenceReasoningRunIdentity } from "../ports/evidence-reasoner.js";
import { EvidenceReasoningObservability } from "../ports/evidence-reasoning-observability.js";
import { LlmGenerationResponse, LlmProvider } from "../ports/llm-provider.js";
import { NoopReasoningWorkflowTelemetry, ReasoningWorkflowTelemetry } from "../ports/reasoning-workflow-telemetry.js";

const maxGenerationAttempts = 2;
const recoveryMaxPredict = 8192;

type ReasoningFailureDiagnostic = {
  errorCode: EvidenceReasoningValidationDiagnostic["errorCode"] | "provider_error" | "output_truncated";
  errorSummary: string;
  validationIssueCount?: number;
  validationIssues?: string;
  errorStack?: string;
};

function isValidationFailure(error: unknown): boolean {
  return error instanceof Error && (
    error.message.startsWith("Evidence Reasoner returned output") ||
    error.message.startsWith("Evidence reasoner")
  );
}

function describeReasoningFailure(error: unknown): ReasoningFailureDiagnostic {
  const errorStack = error instanceof Error ? error.stack : undefined;
  if (isValidationFailure(error)) return { ...describeEvidenceReasoningValidationError(error), errorStack };
  if (error instanceof Error && error.message === "Ollama stopped generation because the output-token limit was reached.") {
    return { errorCode: "output_truncated", errorSummary: "The model reached its output-token limit before completing the schema-bound response.", errorStack };
  }
  return { errorCode: "provider_error", errorSummary: "The configured LLM provider did not produce a usable response.", errorStack };
}

function fallbackCoverage(requirement: CandidateEvidencePack["requirements"][number]): RequirementCoverage {
  return {
    requirementId: requirement.requirementId,
    requirementText: requirement.requirementText,
    importance: requirement.importance,
    coverageStatus: "missing",
    selectedEvidenceIds: [],
    rejectedCandidateEvidenceIds: [],
    selections: [],
    rejections: [],
    strengthFactors: [],
    limitations: ["The model did not return a valid structured coverage decision, so no candidate evidence was selected."],
    explanation: "Coverage is recorded as missing because the bounded reasoner response could not be validated."
  };
}

function fallbackCuratedEvidencePack(command: Parameters<EvidenceReasoner["reason"]>[0], run: EvidenceReasoningRunIdentity, diagnostic: ReasoningFailureDiagnostic): DegradedEvidenceReasoningResult {
  return {
    curatedEvidencePack: finalizeCuratedEvidencePack({
      id: randomUUID(),
      runIdentity: run.runIdentity,
      jobDescriptionId: command.candidatePack.jobDescriptionId,
      jobAnalysisId: command.candidatePack.jobAnalysisId,
      candidatePackVersion: command.candidatePack.version,
      candidatePackHash: command.candidatePack.hash,
      provider: run.provider,
      model: run.model,
      promptVersion: evidenceReasoningPromptVersion,
      createdAt: new Date(),
      overallCoverageSummary: "No model-derived evidence was selected because the structured reasoning response could not be validated.",
      requirementCoverage: command.candidatePack.requirements.map(fallbackCoverage),
      recommendedEvidence: [],
      discardedEvidence: [],
      missingEvidence: [],
      warnings: [
        ...command.candidatePack.warnings,
        `The evidence reasoner exhausted ${maxGenerationAttempts} schema-bound attempt(s) (${diagnostic.errorCode}). This degraded result was not persisted; retry once the LLM is ready or choose a model that supports Ollama structured output.`
      ],
      limitations: ["No LLM-derived curation was accepted because every response failed local validation."]
    }),
    fallbackDiagnostic: {
      ...diagnostic,
      attempts: maxGenerationAttempts
    }
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class LlmEvidenceReasoner implements EvidenceReasoner {
  constructor(
    private readonly provider: LlmProvider,
    private readonly observability: EvidenceReasoningObservability,
    private readonly telemetry: ReasoningWorkflowTelemetry = new NoopReasoningWorkflowTelemetry()
  ) {}

  getRunIdentity(command: Parameters<EvidenceReasoner["reason"]>[0]): EvidenceReasoningRunIdentity {
    const identity = this.provider.resolveIdentity(command.model);
    const runIdentity = createHash("sha256").update(JSON.stringify({
      jobDescriptionId: command.candidatePack.jobDescriptionId,
      jobAnalysisId: command.candidatePack.jobAnalysisId,
      candidatePackVersion: command.candidatePack.version,
      candidatePackHash: command.candidatePack.hash,
      provider: identity.provider,
      model: identity.model,
      promptVersion: evidenceReasoningPromptVersion
    })).digest("hex");
    return { ...identity, runIdentity, promptVersion: evidenceReasoningPromptVersion };
  }

  async reason(command: Parameters<EvidenceReasoner["reason"]>[0]): Promise<EvidenceReasoningResult> {
    const run = this.getRunIdentity(command);
    const trace = this.observability.trace("evidence-reasoning", {
      jobDescriptionId: command.candidatePack.jobDescriptionId,
      jobAnalysisId: command.candidatePack.jobAnalysisId,
      candidatePackVersion: command.candidatePack.version,
      candidatePackHash: command.candidatePack.hash,
      promptVersion: run.promptVersion,
      requestedModel: command.model,
      runIdentity: run.runIdentity,
      traceId: this.telemetry.traceId()
    });
    try {
      if (!command.candidatePack.requirements.some((requirement) => requirement.reasonerCandidateIds.length > 0)) {
        const finalized = finalizeCuratedEvidencePack({
          id: randomUUID(),
          runIdentity: run.runIdentity,
          jobDescriptionId: command.candidatePack.jobDescriptionId,
          jobAnalysisId: command.candidatePack.jobAnalysisId,
          candidatePackVersion: command.candidatePack.version,
          candidatePackHash: command.candidatePack.hash,
          provider: run.provider,
          model: run.model,
          promptVersion: evidenceReasoningPromptVersion,
          createdAt: new Date(),
          overallCoverageSummary: "No eligible canonical evidence was supplied for the job requirements.",
          requirementCoverage: command.candidatePack.requirements.map(missingCoverage),
          recommendedEvidence: [],
          discardedEvidence: [],
          missingEvidence: [],
          warnings: [...command.candidatePack.warnings],
          limitations: ["The candidate pack contains no evidence that addresses the job requirements."]
        });
        await trace.event("no_eligible_evidence");
        return finalized;
      }

      const payload = await this.telemetry.run("build_llm_payload", { runIdentity: run.runIdentity, candidatePackHash: command.candidatePack.hash }, async () => ({
        systemPrompt: evidenceReasoningSystemPrompt,
        userPrompt: buildEvidenceReasoningUserPrompt(command.candidatePack),
        model: command.model,
        responseFormat: evidenceReasoningOutputJsonSchema,
        disableThinking: true
      }));

      let lastDiagnostic: ReasoningFailureDiagnostic = { errorCode: "provider_error", errorSummary: "The configured LLM provider did not produce a usable response." };
      for (let attempt = 1; attempt <= maxGenerationAttempts; attempt += 1) {
        const attemptAttributes = { runIdentity: run.runIdentity, candidatePackHash: command.candidatePack.hash, attempt: String(attempt) };
        const startedAt = performance.now();
        let generated: LlmGenerationResponse | undefined;
        try {
          generated = await this.telemetry.run("ollama_inference", attemptAttributes, () => this.provider.generate({
            ...payload,
            ...(attempt === maxGenerationAttempts ? { maxPredict: recoveryMaxPredict } : {})
          }));
          if (generated.finishReason === "length") {
            throw new Error("Ollama stopped generation because the output-token limit was reached.");
          }
          await trace.generation?.({
            name: "ollama_inference",
            model: generated.model,
            metadata: { provider: generated.provider, promptVersion: run.promptVersion, attempt },
            usage: generated.usage
          });
          await trace.event("provider_completed", { provider: generated.provider, model: generated.model, attempt });

          const finalized = await this.telemetry.run("schema_validation", attemptAttributes, async () => {
            const content = parseEvidenceReasoningOutput(generated!.content, command.candidatePack);
            return finalizeCuratedEvidencePack({
              id: randomUUID(),
              runIdentity: run.runIdentity,
              jobDescriptionId: command.candidatePack.jobDescriptionId,
              jobAnalysisId: command.candidatePack.jobAnalysisId,
              candidatePackVersion: command.candidatePack.version,
              candidatePackHash: command.candidatePack.hash,
              provider: generated!.provider,
              model: generated!.model,
              promptVersion: evidenceReasoningPromptVersion,
              createdAt: new Date(),
              overallCoverageSummary: content.overallCoverageSummary,
              requirementCoverage: content.coverage,
              recommendedEvidence: [],
              discardedEvidence: [],
              missingEvidence: [],
              warnings: [...command.candidatePack.warnings, ...content.warnings],
              limitations: content.limitations
            });
          });
          const attributes = { provider: generated.provider, model: generated.model, prompt_version: run.promptVersion, outcome: "success" };
          this.telemetry.record("inferenceDuration", performance.now() - startedAt, attributes);
          if (generated.usage?.promptTokens !== undefined) this.telemetry.record("promptTokens", generated.usage.promptTokens, attributes);
          if (generated.usage?.completionTokens !== undefined) this.telemetry.record("completionTokens", generated.usage.completionTokens, attributes);
          await trace.event("validation_succeeded", { attempt });
          return finalized;
        } catch (error) {
          const diagnostic = describeReasoningFailure(error);
          lastDiagnostic = diagnostic;
          const willRetry = attempt < maxGenerationAttempts;
          const outcome = diagnostic.errorCode === "provider_error" ? "provider_error" : "validation_error";
          const attributes = { provider: generated?.provider ?? run.provider, model: generated?.model ?? run.model, prompt_version: run.promptVersion, outcome };
          this.telemetry.record("inferenceDuration", performance.now() - startedAt, attributes);
          if (generated?.usage?.promptTokens !== undefined) this.telemetry.record("promptTokens", generated.usage.promptTokens, attributes);
          if (generated?.usage?.completionTokens !== undefined) this.telemetry.record("completionTokens", generated.usage.completionTokens, attributes);
          if (isValidationFailure(error) || diagnostic.errorCode === "output_truncated") {
            this.telemetry.count("validationFailures", { outcome: willRetry ? "retry" : "fallback", failure_class: diagnostic.errorCode });
          }
          await trace.event(willRetry ? "reasoning_retrying" : "reasoning_fallback", {
            attempt,
            errorCode: diagnostic.errorCode,
            errorSummary: diagnostic.errorSummary,
            validationIssueCount: diagnostic.validationIssueCount,
            validationIssues: diagnostic.validationIssues
          });
          if (willRetry) {
            if (diagnostic.errorCode === "provider_error") await sleep(750);
            continue;
          }
        }
      }

      this.telemetry.count("failures", { outcome: "degraded", failure_class: lastDiagnostic.errorCode });
      return fallbackCuratedEvidencePack(command, run, lastDiagnostic);
    } finally {
      await trace.flush();
    }
  }
}
