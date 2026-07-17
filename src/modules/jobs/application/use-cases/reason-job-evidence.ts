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
      let runIdentity: { provider: string; model: string; promptVersion: string } | undefined;
      return telemetry.run("command", { jobDescriptionId: command.jobDescriptionId }, async () => {
        telemetry.log("jobs.reason.started", { jobDescriptionId: command.jobDescriptionId });
        try {
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
          runIdentity = run;
          const existing = await dependencies.curatedEvidencePackRepository.findByRunIdentity(command.jobDescriptionId, run.runIdentity);
          if (existing) {
            telemetry.log("jobs.reason.reused", { jobDescriptionId: command.jobDescriptionId, runIdentity: run.runIdentity, candidatePackHash: candidatePack.hash });
            telemetry.record("commandDuration", performance.now() - startedAt, { provider: run.provider, model: run.model, prompt_version: run.promptVersion, outcome: "reused" });
            return existing;
          }
          const curated = await dependencies.evidenceReasoner.reason({ candidatePack, model: command.model });
          if (curated.isFallback) {
            telemetry.record("commandDuration", performance.now() - startedAt, { provider: run.provider, model: run.model, prompt_version: run.promptVersion, outcome: "degraded" });
            telemetry.log("jobs.reason.degraded", { jobDescriptionId: command.jobDescriptionId, runIdentity: run.runIdentity, candidatePackHash: candidatePack.hash, provider: run.provider, model: run.model, promptVersion: run.promptVersion }, "error");
            return curated;
          }
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
          telemetry.log("jobs.reason.completed", { jobDescriptionId: command.jobDescriptionId, runIdentity: run.runIdentity, candidatePackHash: candidatePack.hash, provider: run.provider, model: run.model, promptVersion: run.promptVersion });
          return curated;
        } catch (error) {
          telemetry.record("commandDuration", performance.now() - startedAt, {
            provider: runIdentity?.provider,
            model: runIdentity?.model,
            prompt_version: runIdentity?.promptVersion,
            outcome: "failure"
          });
          telemetry.count("failures", { outcome: "failure", failure_class: "reasoning_error" });
          telemetry.log("jobs.reason.failed", { jobDescriptionId: command.jobDescriptionId, failure_class: "reasoning_error",  "abc": 123}, "error");
          throw error;
        }
      });
    }
  };
}
