import { createHash, randomUUID } from "node:crypto";

import { CuratedEvidencePack } from "../../domain/model.js";
import { finalizeCuratedEvidencePack, missingCoverage } from "../evidence-curation.js";
import { buildEvidenceReasoningUserPrompt, evidenceReasoningPromptVersion, evidenceReasoningSystemPrompt } from "../evidence-reasoning-prompt.js";
import { parseEvidenceReasoningOutput } from "../evidence-reasoning-schema.js";
import { EvidenceReasoner, EvidenceReasoningRunIdentity } from "../ports/evidence-reasoner.js";
import { EvidenceReasoningObservability } from "../ports/evidence-reasoning-observability.js";
import { LlmProvider } from "../ports/llm-provider.js";

export class LlmEvidenceReasoner implements EvidenceReasoner {
  constructor(
    private readonly provider: LlmProvider,
    private readonly observability: EvidenceReasoningObservability
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
        generated = await this.provider.generate({
          systemPrompt: evidenceReasoningSystemPrompt,
          userPrompt: buildEvidenceReasoningUserPrompt(command.candidatePack),
          model: command.model,
          responseFormat: "json"
        });
        await trace.event("provider_completed", { provider: generated.provider, model: generated.model });
      } catch (error) {
        await trace.event("provider_failed", { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
      try {
        const content = parseEvidenceReasoningOutput(generated.content, command.candidatePack);
        const finalized = finalizeCuratedEvidencePack({
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
        await trace.event("validation_succeeded");
        return finalized;
      } catch (error) {
        await trace.event("validation_failed", { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    } finally {
      await trace.flush();
    }
  }
}
