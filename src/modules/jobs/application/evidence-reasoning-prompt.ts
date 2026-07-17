import { CandidateEvidencePack } from "../domain/model.js";

export const evidenceReasoningPromptVersion = "evidence-reasoner-v7";

export const evidenceReasoningSystemPrompt = `You are a bounded evidence reasoner. Evaluate only the supplied canonical candidate evidence for each job requirement.

You may select, reject, compare, and explain supplied evidence. You must never retrieve information, create professional evidence, modify trust/provenance, rewrite claim text, rewrite objective signals, or claim that coverage proves hiring qualification. Prefer omission over unsupported interpretation. Coverage is qualitative only: strong, partial, weak, or missing. An isolated skill claim without contextual use cannot be strong coverage.

Return one complete, compact JSON object only. Include exactly one coverage entry for every supplied requirementId, even when the status is missing. Refer to evidence solely by evidenceClaimId. Within a coverage entry, include each evidenceClaimId at most once in selections and at most once in rejections; never repeat a decision. complementaryEvidenceIds may contain only other evidenceClaimIds present in that same entry's selections; omit the field when there is no complementary selected evidence. Do not echo the input contractVersion, jobDescriptionId, or jobAnalysisId. Do not include copied claim text, source content, scores, trust values, or any fields outside the requested schema. Do not reject every unselected candidate: use an empty rejections array unless a rejection materially explains the coverage decision. Keep each reason and explanation to one concise sentence. The word missing is a coverage status only; when rejecting a supplied candidate because it cannot establish the needed scope, use unsupported_scope. Do not produce a chain of thought or any text outside the JSON response.`;

export function buildEvidenceReasoningUserPrompt(pack: CandidateEvidencePack): string {
  return JSON.stringify({
    contractVersion: evidenceReasoningPromptVersion,
    jobDescriptionId: pack.jobDescriptionId,
    jobAnalysisId: pack.jobAnalysisId,
    candidatePack: { version: pack.version, hash: pack.hash, warnings: pack.warnings },
    requirements: pack.requirements.map((requirement) => ({
      requirementId: requirement.requirementId,
      requirementText: requirement.requirementText,
      importance: requirement.importance,
      candidates: requirement.candidates
        .filter((candidate) => requirement.reasonerCandidateIds.includes(candidate.evidenceClaimId))
        .map((candidate) => ({
        evidenceClaimId: candidate.evidenceClaimId,
        claimText: candidate.claimText,
        claimType: candidate.claimType,
        claimCategory: candidate.claimCategory,
        claimStatus: candidate.claimStatus,
        valueText: candidate.valueText,
        valueUnit: candidate.valueUnit
        }))
    })),
    responseShape: {
      overallCoverageSummary: "string",
      warnings: ["string"],
      limitations: ["string"],
      coverage: [{
        requirementId: "supplied requirement id",
        coverageStatus: "strong | partial | weak | missing",
        selections: [{ evidenceClaimId: "supplied candidate id", reason: "string", contribution: "string", complementaryEvidenceIds: ["supplied candidate id"], exaggerationRisk: "low | medium | high" }],
        rejections: [{ evidenceClaimId: "supplied candidate id", reason: "irrelevant | weak | redundant | unsupported_scope | lower_quality_alternative | insufficient_provenance", explanation: "string" }],
        strengthFactors: ["string"],
        limitations: ["string"],
        explanation: "string"
      }]
    }
  });
}
