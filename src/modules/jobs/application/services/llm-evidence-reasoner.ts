import { createHash, randomUUID } from "node:crypto";

import { CuratedEvidencePack } from "../../domain/model.js";
import { finalizeCuratedEvidencePack, missingCoverage } from "../evidence-curation.js";
import { buildEvidenceReasoningUserPrompt, evidenceReasoningPromptVersion, evidenceReasoningSystemPrompt } from "../evidence-reasoning-prompt.js";
import { parseEvidenceReasoningOutput } from "../evidence-reasoning-schema.js";
import { EvidenceReasoner, EvidenceReasoningRunIdentity } from "../ports/evidence-reasoner.js";
import { EvidenceReasoningObservability } from "../ports/evidence-reasoning-observability.js";
import { LlmProvider } from "../ports/llm-provider.js";
import { NoopReasoningWorkflowTelemetry, ReasoningWorkflowTelemetry } from "../ports/reasoning-workflow-telemetry.js";

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

  async reason(command: Parameters<EvidenceReasoner["reason"]>[0]): Promise<CuratedEvidencePack> {
    const run = this.getRunIdentity(command);
    const trace = this.observability.trace("evidence-reasoning", {
      jobDescriptionId: command.candidatePack.jobDescriptionId,
      jobAnalysisId: command.candidatePack.jobAnalysisId,
      candidatePackVersion: command.candidatePack.version,
      candidatePackHash: command.candidatePack.hash,
      promptVersion: run.promptVersion,
      requestedModel: command.model,
      runIdentity: run.runIdentity
      , traceId: this.telemetry.traceId()
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
      let generated;
      try {
        const payload = await this.telemetry.run("build_llm_payload", { runIdentity: run.runIdentity, candidatePackHash: command.candidatePack.hash }, async () => ({
          systemPrompt: evidenceReasoningSystemPrompt,
          userPrompt: buildEvidenceReasoningUserPrompt(command.candidatePack),
          model: command.model,
          responseFormat: "json" as const
        }));
        const startedAt = performance.now();
        generated = await this.telemetry.run("ollama_inference", { runIdentity: run.runIdentity, candidatePackHash: command.candidatePack.hash }, () => this.provider.generate(payload));
        this.telemetry.record("inferenceDuration", performance.now() - startedAt, { provider: generated.provider, model: generated.model, prompt_version: run.promptVersion, outcome: "success" });
        if (generated.usage?.promptTokens !== undefined) this.telemetry.record("promptTokens", generated.usage.promptTokens, { provider: generated.provider, model: generated.model, prompt_version: run.promptVersion, outcome: "success" });
        if (generated.usage?.completionTokens !== undefined) this.telemetry.record("completionTokens", generated.usage.completionTokens, { provider: generated.provider, model: generated.model, prompt_version: run.promptVersion, outcome: "success" });
        await trace.generation?.({
          name: "ollama_inference",
          model: generated.model,
          metadata: { provider: generated.provider, promptVersion: run.promptVersion },
          usage: generated.usage
        });
        await trace.event("provider_completed", { provider: generated.provider, model: generated.model });
      } catch (error) {
        await trace.event("provider_failed", { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
      try {
        const finalized = await this.telemetry.run("schema_validation", { runIdentity: run.runIdentity, candidatePackHash: command.candidatePack.hash }, async () => {
          const content = parseEvidenceReasoningOutput(generated.content, command.candidatePack);
          return finalizeCuratedEvidencePack({
          id: randomUUID(),
          runIdentity: run.runIdentity,
          jobDescriptionId: command.candidatePack.jobDescriptionId,
          jobAnalysisId: command.candidatePack.jobAnalysisId,
          candidatePackVersion: command.candidatePack.version,
          candidatePackHash: command.candidatePack.hash,
          provider: generated.provider,
          model: generated.model,
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
        await trace.event("validation_succeeded");
        return finalized;
      } catch (error) {
        this.telemetry.count("validationFailures", { outcome: "failure", failure_class: "validation_error" });
        await trace.event("validation_failed", { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    } finally {
      await trace.flush();
    }
  }
}
