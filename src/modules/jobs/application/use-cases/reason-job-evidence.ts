import { EvidencePack } from "../../../retrieval/application/types.js";
import { CandidateEvidencePack } from "../../domain/model.js";
import { CandidateEvidencePackBuilder } from "../ports/candidate-evidence-pack-builder.js";
import { CuratedEvidencePackRepository } from "../ports/curated-evidence-pack-repository.js";
import { EvidenceReasoner } from "../ports/evidence-reasoner.js";
import { JobAnalysisRepository } from "../ports/job-analysis-repository.js";
import { JobDescriptionRepository } from "../ports/job-description-repository.js";
import { NoopReasoningWorkflowTelemetry, ReasoningWorkflowTelemetry } from "../ports/reasoning-workflow-telemetry.js";

export function createReasonJobEvidenceUseCase(dependencies: {
  jobDescriptionRepository: JobDescriptionRepository;
  jobAnalysisRepository: JobAnalysisRepository;
  candidateEvidencePackBuilder: CandidateEvidencePackBuilder;
  curatedEvidencePackRepository: CuratedEvidencePackRepository;
  evidenceReasoner: EvidenceReasoner;
  telemetry?: ReasoningWorkflowTelemetry;
}) {
  const telemetry = dependencies.telemetry ?? new NoopReasoningWorkflowTelemetry();
  return {
    async execute(command: { jobDescriptionId: string; evidencePack?: EvidencePack; candidatePack?: CandidateEvidencePack; model?: string }) {
      const startedAt = performance.now();
      return telemetry.run("command", { jobDescriptionId: command.jobDescriptionId }, async () => {
      const jobDescription = await telemetry.run("load_job", { jobDescriptionId: command.jobDescriptionId }, () => dependencies.jobDescriptionRepository.findById(command.jobDescriptionId));
      if (!jobDescription) {
        throw new Error(`Job description not found: ${command.jobDescriptionId}`);
      }
      const analysis = await telemetry.run("load_job_analysis", { jobDescriptionId: command.jobDescriptionId }, () => dependencies.jobAnalysisRepository.findLatestByJobDescriptionId(command.jobDescriptionId));
      const candidatePack = command.candidatePack ?? (() => {
        if (!command.evidencePack) {
          throw new Error("Reasoning requires an Evidence Pack or a prepared Candidate Evidence Pack.");
        }
        return dependencies.candidateEvidencePackBuilder.build({
          jobDescription,
          jobAnalysisId: analysis?.id,
          evidencePack: command.evidencePack
        });
      })();
      telemetry.record("candidateEvidence", candidatePack.requirements.reduce((total, requirement) => total + requirement.candidates.length, 0));
      telemetry.record("candidatePackBytes", Buffer.byteLength(JSON.stringify(candidatePack)));
      for (const requirement of candidatePack.requirements) telemetry.record("evidencePerRequirement", requirement.reasonerCandidateIds.length);
      const run = dependencies.evidenceReasoner.getRunIdentity({ candidatePack, model: command.model });
      const existing = await dependencies.curatedEvidencePackRepository.findByRunIdentity(command.jobDescriptionId, run.runIdentity);
      if (existing) {
        return existing;
      }
      const curated = await dependencies.evidenceReasoner.reason({ candidatePack, model: command.model });
      try {
        await telemetry.run("persistence", { jobDescriptionId: command.jobDescriptionId, runIdentity: run.runIdentity, candidatePackHash: candidatePack.hash }, () => dependencies.curatedEvidencePackRepository.save(curated));
      } catch (error) {
        const concurrent = await dependencies.curatedEvidencePackRepository.findByRunIdentity(command.jobDescriptionId, run.runIdentity);
        if (concurrent) {
          return concurrent;
        }
        throw error;
      }
      telemetry.record("commandDuration", performance.now() - startedAt, { provider: run.provider, model: run.model, prompt_version: run.promptVersion, outcome: "success" });
      return curated;
      });
    }
  };
}
