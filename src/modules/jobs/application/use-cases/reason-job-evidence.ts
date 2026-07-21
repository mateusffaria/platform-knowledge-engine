import { randomUUID } from "node:crypto";

import { EvidencePack } from "../../../retrieval/application/types.js";
import { CandidateEvidencePack, isDegradedEvidenceReasoningResult } from "../../domain/model.js";
import { candidateComponentsOf } from "../../domain/atomic-job-requirement.js";
import { CandidateEvidencePackBuilder } from "../ports/candidate-evidence-pack-builder.js";
import { CuratedEvidencePackRepository } from "../ports/curated-evidence-pack-repository.js";
import { EvidenceReasoner } from "../ports/evidence-reasoner.js";
import { JobAnalysisRepository } from "../ports/job-analysis-repository.js";
import { JobDescriptionRepository } from "../ports/job-description-repository.js";
import { NoopReasoningWorkflowTelemetry, ReasoningWorkflowTelemetry } from "../ports/reasoning-workflow-telemetry.js";

type ReasonCommandEvent = Record<string, string | number | boolean | undefined>;

function errorFields(error: unknown): ReasonCommandEvent {
  if (error instanceof Error) {
    return {
      error_type: error.name,
      error_message: error.message,
      error_stack: error.stack
    };
  }
  return { error_type: "NonError", error_message: String(error) };
}

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
    async execute(command: { jobDescriptionId: string; evidencePack?: EvidencePack; candidatePack?: CandidateEvidencePack; model?: string; force?: boolean }) {
      const startedAt = performance.now();
      let runIdentity: { provider: string; model: string; promptVersion: string } | undefined;
      const event: ReasonCommandEvent = {
        command: "jobs.reason",
        job_description_id: command.jobDescriptionId
      };
      return telemetry.run("command", { jobDescriptionId: command.jobDescriptionId }, async () => {
        try {
          const jobDescription = await telemetry.run("load_job", { jobDescriptionId: command.jobDescriptionId }, () => dependencies.jobDescriptionRepository.findById(command.jobDescriptionId));
          if (!jobDescription) {
            throw new Error(`Job description not found: ${command.jobDescriptionId}`);
          }
          const analysis = await telemetry.run("load_job_analysis", { jobDescriptionId: command.jobDescriptionId }, () => dependencies.jobAnalysisRepository.findLatestByJobDescriptionId(command.jobDescriptionId));
          event.job_analysis_id = analysis?.id;
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
          const components = candidatePack.requirements.flatMap((requirement) => candidateComponentsOf(requirement));
          const candidateCount = components.reduce((total, component) => total + component.candidates.length, 0);
          const reasonerCandidateCount = components.reduce((total, component) => total + component.reasonerCandidateIds.length, 0);
          event.candidate_pack_hash = candidatePack.hash;
          event.candidate_pack_version = candidatePack.version;
          event.requirement_count = candidatePack.requirements.length;
          event.parent_requirement_count = candidatePack.requirements.length;
          event.atomic_component_count = components.length;
          event.candidate_count = candidateCount;
          event.reasoner_candidate_count = reasonerCandidateCount;
          telemetry.record("candidateEvidence", candidateCount);
          telemetry.record("candidatePackBytes", Buffer.byteLength(JSON.stringify(candidatePack)));
          for (const component of components) telemetry.record("evidencePerRequirement", component.reasonerCandidateIds.length, { requirement_id: component.requirementId, component_id: component.componentId });
          const reasoningCommand = {
            candidatePack,
            model: command.model,
            ...(command.force ? { regenerationId: randomUUID() } : {})
          };
          const run = dependencies.evidenceReasoner.getRunIdentity(reasoningCommand);
          runIdentity = run;
          event.run_identity = run.runIdentity;
          event.provider = run.provider;
          event.model = run.model;
          event.prompt_version = run.promptVersion;
          event.cache_bypassed = command.force === true;
          if (!command.force) {
            const existing = await dependencies.curatedEvidencePackRepository.findByRunIdentity(command.jobDescriptionId, run.runIdentity);
            if (existing) {
              event.outcome = "reused";
              event.cached = true;
              event.display_score = existing.displayScore;
              telemetry.record("commandDuration", performance.now() - startedAt, { provider: run.provider, model: run.model, prompt_version: run.promptVersion, outcome: "reused" });
              return existing;
            }
          }
          const reasoningResult = await dependencies.evidenceReasoner.reason(reasoningCommand);
          if (isDegradedEvidenceReasoningResult(reasoningResult)) {
            const { curatedEvidencePack: curated, fallbackDiagnostic } = reasoningResult;
            event.outcome = "degraded";
            event.degraded = true;
            event.failure_class = fallbackDiagnostic.errorCode;
            event.error_code = fallbackDiagnostic.errorCode;
            event.error_summary = fallbackDiagnostic.errorSummary;
            event.validation_issue_count = fallbackDiagnostic.validationIssueCount;
            event.validation_issues = fallbackDiagnostic.validationIssues;
            event.error_stack = fallbackDiagnostic.errorStack;
            event.reasoning_attempts = fallbackDiagnostic.attempts;
            telemetry.record("commandDuration", performance.now() - startedAt, { provider: run.provider, model: run.model, prompt_version: run.promptVersion, outcome: "degraded" });
            return curated;
          }
          const curated = reasoningResult;
          try {
            await telemetry.run("persistence", { jobDescriptionId: command.jobDescriptionId, runIdentity: run.runIdentity, candidatePackHash: candidatePack.hash }, () => dependencies.curatedEvidencePackRepository.save(curated));
          } catch (error) {
            const concurrent = await dependencies.curatedEvidencePackRepository.findByRunIdentity(command.jobDescriptionId, run.runIdentity);
            if (concurrent) {
              event.outcome = "reused";
              event.cached = true;
              event.cache_race = true;
              event.display_score = concurrent.displayScore;
              return concurrent;
            }
            throw error;
          }
          event.outcome = "success";
          event.display_score = curated.displayScore;
          event.selected_evidence_count = curated.recommendedEvidence.length;
          event.discarded_evidence_count = curated.discardedEvidence.length;
          event.missing_requirement_count = curated.requirementCoverage.filter((coverage) => coverage.coverageStatus === "missing").length;
          event.missing_component_count = curated.missingEvidence.filter((missing) => missing.componentId !== undefined).length;
          telemetry.record("commandDuration", performance.now() - startedAt, { provider: run.provider, model: run.model, prompt_version: run.promptVersion, outcome: "success" });
          return curated;
        } catch (error) {
          event.outcome = "failure";
          event.failure_class = "reasoning_error";
          Object.assign(event, errorFields(error));
          telemetry.record("commandDuration", performance.now() - startedAt, {
            provider: runIdentity?.provider,
            model: runIdentity?.model,
            prompt_version: runIdentity?.promptVersion,
            outcome: "failure"
          });
          telemetry.count("failures", { outcome: "failure", failure_class: "reasoning_error" });
          throw error;
        } finally {
          event.duration_ms = Math.round(performance.now() - startedAt);
          telemetry.event("jobs.reason.command", event, event.outcome === "failure" || event.outcome === "degraded" ? "error" : "info");
        }
      });
    }
  };
}
