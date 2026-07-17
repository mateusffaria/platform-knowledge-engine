import { describe, expect, it, vi } from "vitest";

import { buildCandidateEvidencePack, hashCandidateEvidencePack } from "../src/modules/jobs/application/candidate-evidence-pack.js";
import { buildEvidenceReasoningUserPrompt } from "../src/modules/jobs/application/evidence-reasoning-prompt.js";
import { deduplicateCrossRequirementSelections, displayScore, missingCoverage } from "../src/modules/jobs/application/evidence-curation.js";
import { describeEvidenceReasoningValidationError, parseEvidenceReasoningOutput } from "../src/modules/jobs/application/evidence-reasoning-schema.js";
import { EvidenceReasoner } from "../src/modules/jobs/application/ports/evidence-reasoner.js";
import { EvidenceReasoningObservability, EvidenceReasoningTrace } from "../src/modules/jobs/application/ports/evidence-reasoning-observability.js";
import { LlmProvider } from "../src/modules/jobs/application/ports/llm-provider.js";
import { ReasoningWorkflowTelemetry } from "../src/modules/jobs/application/ports/reasoning-workflow-telemetry.js";
import { LlmEvidenceReasoner } from "../src/modules/jobs/application/services/llm-evidence-reasoner.js";
import { createReasonJobEvidenceUseCase } from "../src/modules/jobs/application/use-cases/reason-job-evidence.js";
import { CandidateEvidencePack, CuratedEvidencePack, isDegradedEvidenceReasoningResult, JobDescriptionWithRequirements } from "../src/modules/jobs/domain/model.js";
import { DrizzleCuratedEvidencePackRepository } from "../src/modules/jobs/infrastructure/repositories/drizzle-curated-evidence-pack-repository.js";
import { EvidencePack } from "../src/modules/retrieval/application/types.js";

function jobDescription(): JobDescriptionWithRequirements {
  return {
    job: { id: "job-1", sourceType: "markdown", sourcePath: "job.md", rawContent: "Leadership and TypeScript", contentHash: "job-hash", ingestedAt: new Date("2026-07-16T00:00:00.000Z") },
    requirements: [
      { id: "leadership", jobDescriptionId: "job-1", requirementType: "responsibility", importance: "required", originalText: "Technical leadership across teams", sourceExcerpt: "Leadership", sourceLocation: { startLine: 1, endLine: 1 }, inferred: false },
      { id: "typescript", jobDescriptionId: "job-1", requirementType: "technology", importance: "preferred", originalText: "TypeScript", sourceExcerpt: "TypeScript", sourceLocation: { startLine: 1, endLine: 1 }, inferred: false }
    ]
  };
}

function evidencePack(): EvidencePack {
  return {
    query: "leadership TypeScript",
    strategies: ["semantic"],
    generatedAt: new Date(),
    warnings: [],
    items: [
      { evidenceClaimId: "claim-a", knowledgeAssetId: "asset-a", subjectType: "achievement", claimType: "achievement", claimText: "Led architecture decisions across teams.", claimStatus: "confirmed", confidenceScore: 95, finalScore: 0.9, sources: [{ id: "source-a", sourceDocumentId: "document-a", section: "Experience", locator: "line:1", excerpt: "Led architecture decisions." }], retrievalStrategies: ["semantic"] },
      { evidenceClaimId: "claim-b", knowledgeAssetId: "asset-b", subjectType: "experience", claimType: "experience", claimText: "Built TypeScript services with measurable latency improvements.", claimStatus: "confirmed", confidenceScore: 90, finalScore: 0.8, sources: [{ id: "source-b", sourceDocumentId: "document-b", section: "Experience", locator: "line:2", excerpt: "Built TypeScript services." }], retrievalStrategies: ["semantic"] },
      { knowledgeAssetId: "asset-only", subjectType: "knowledge_asset", claimText: "Asset only", confidenceScore: 50, finalScore: 0.2, sources: [], retrievalStrategies: ["semantic"] }
    ]
  };
}

function candidatePack(): CandidateEvidencePack {
  return buildCandidateEvidencePack({ jobDescription: jobDescription(), jobAnalysisId: "analysis-1", evidencePack: evidencePack() });
}

class RecordingTrace implements EvidenceReasoningTrace {
  events: string[] = [];
  flushed = false;
  async event(name: string): Promise<void> { this.events.push(name); }
  async flush(): Promise<void> { this.flushed = true; }
}

class RecordingObservability implements EvidenceReasoningObservability {
  traces: RecordingTrace[] = [];
  trace(): EvidenceReasoningTrace {
    const trace = new RecordingTrace();
    this.traces.push(trace);
    return trace;
  }
}

class RecordingWorkflowTelemetry implements ReasoningWorkflowTelemetry {
  events: Array<{ name: string; attributes: Record<string, string | number | boolean | undefined>; severity: "info" | "error" }> = [];
  async run<T>(_stage: string, _attributes: Record<string, string | undefined>, operation: () => Promise<T>): Promise<T> { return operation(); }
  record(): void {}
  count(): void {}
  event(name: string, attributes: Record<string, string | number | boolean | undefined> = {}, severity: "info" | "error" = "info"): void {
    this.events.push({ name, attributes, severity });
  }
  traceId(): string | undefined { return undefined; }
}

function provider(content: string): LlmProvider {
  return {
    resolveIdentity: (model) => ({ provider: "ollama", model: model ?? "test-model" }),
    generate: vi.fn(async () => ({ content, provider: "ollama", model: "test-model" }))
  };
}

function validOutput(): string {
  return JSON.stringify({
    overallCoverageSummary: "Leadership is partially supported and TypeScript is strongly supported by contextual evidence.",
    warnings: [],
    limitations: ["Coverage is qualitative and does not prove qualification."],
    coverage: [
      { requirementId: "leadership", coverageStatus: "partial", selections: [{ evidenceClaimId: "claim-a", reason: "Direct leadership evidence", contribution: "Demonstrates architectural leadership across teams", exaggerationRisk: "low" }], rejections: [{ evidenceClaimId: "claim-b", reason: "irrelevant", explanation: "Does not directly show leadership." }], strengthFactors: ["Cross-team architectural context"], limitations: ["Organizational scope is not explicit."], explanation: "Direct leadership evidence with limited scope." },
      { requirementId: "typescript", coverageStatus: "strong", selections: [{ evidenceClaimId: "claim-b", reason: "Contextual technology evidence", contribution: "Shows TypeScript use with measurable impact", exaggerationRisk: "low" }], rejections: [{ evidenceClaimId: "claim-a", reason: "irrelevant", explanation: "Does not directly demonstrate TypeScript." }], strengthFactors: ["Contextual measurable impact"], limitations: [], explanation: "Strong contextual TypeScript evidence." }
    ]
  });
}

describe("Candidate Evidence Pack", () => {
  it("is hash-stable and excludes asset-only retrieval output", () => {
    const first = candidatePack();
    const second = candidatePack();

    expect(first.hash).toBe(second.hash);
    expect(first.requirements).toHaveLength(2);
    expect(first.requirements[0].candidates.map((candidate) => candidate.evidenceClaimId)).toEqual(["claim-a", "claim-b"]);
    expect(first.warnings).toContain("1 retrieval result(s) without canonical evidence-claim identities were excluded from evidence reasoning.");
  });

  it("hashes only deterministic bounded reasoner input", () => {
    const first = candidatePack();
    const changedRetrievalMetadata = structuredClone(first);
    changedRetrievalMetadata.requirements[0].candidates[0].sources.reverse();
    changedRetrievalMetadata.requirements[0].candidates[0].objectiveSignals.semanticScore = 0.123456;
    changedRetrievalMetadata.requirements[0].diagnostics.rawRetrievalResultCount += 10;
    const { hash: _hash, generatedAt: _generatedAt, ...hashInput } = changedRetrievalMetadata;

    expect(hashCandidateEvidencePack(hashInput)).toBe(first.hash);

    changedRetrievalMetadata.requirements[0].candidates[0].claimText = "Changed reasoner-visible claim";
    const { hash: _changedHash, generatedAt: _changedAt, ...changedHashInput } = changedRetrievalMetadata;
    expect(hashCandidateEvidencePack(changedHashInput)).not.toBe(first.hash);
  });

  it("keeps complete candidates while selecting a ranked, exact-structured-safe reasoner view", () => {
    const pack = buildCandidateEvidencePack({
      jobDescription: jobDescription(),
      evidencePack: {
        ...evidencePack(),
        items: [
          { evidenceClaimId: "semantic-high", knowledgeAssetId: "asset-high", subjectType: "experience", claimText: "High ranked semantic evidence", claimStatus: "confirmed", confidenceScore: 90, finalScore: 0.9, semanticScore: 0.9, sources: [], retrievalStrategies: ["semantic"] },
          { evidenceClaimId: "semantic-limited", knowledgeAssetId: "asset-limited", subjectType: "experience", claimText: "Limited semantic evidence", claimStatus: "confirmed", confidenceScore: 90, finalScore: 0.8, semanticScore: 0.8, sources: [], retrievalStrategies: ["semantic"] },
          { evidenceClaimId: "exact-low", knowledgeAssetId: "asset-exact", subjectType: "experience", claimText: "Exact structured evidence", claimStatus: "confirmed", confidenceScore: 60, finalScore: 0.2, semanticScore: 0.1, structuredScore: 1, sources: [], retrievalStrategies: ["structured"] },
          { evidenceClaimId: "semantic-low", knowledgeAssetId: "asset-low", subjectType: "experience", claimText: "Below threshold evidence", claimStatus: "confirmed", confidenceScore: 60, finalScore: 0.1, semanticScore: 0.1, sources: [], retrievalStrategies: ["semantic"] }
        ]
      },
      selection: { limitPerRequirement: 1, minCandidateScore: 0.5 }
    });

    for (const requirement of pack.requirements) {
      expect(requirement.candidates.map((candidate) => candidate.evidenceClaimId)).toEqual(["semantic-high", "semantic-limited", "exact-low", "semantic-low"]);
      expect(requirement.reasonerCandidateIds).toEqual(["semantic-high", "exact-low"]);
      expect(requirement.diagnostics.selectedForReasonerCount).toBe(2);
      expect(requirement.diagnostics.selectionExclusions.map((item) => item.reasonCode)).toEqual(["limit_per_requirement", "minimum_candidate_score_not_met"]);
    }
    const prompt = JSON.parse(buildEvidenceReasoningUserPrompt(pack));
    expect(prompt.requirements[0].candidates.map((candidate: { evidenceClaimId: string }) => candidate.evidenceClaimId)).toEqual(["semantic-high", "exact-low"]);
  });

  it("makes missing coverage and display scores deterministic", () => {
    const missing = missingCoverage(candidatePack().requirements[0]);
    expect(missing.coverageStatus).toBe("missing");
    expect(displayScore([{ ...missing, coverageStatus: "partial" }, { ...missing, requirementId: "other", importance: "preferred", coverageStatus: "strong" }])).toBe(78);
  });
});

describe("LlmEvidenceReasoner", () => {
  it("validates referential output, preserves canonical evidence, and flushes traces", async () => {
    const llm = provider(validOutput());
    const observability = new RecordingObservability();
    const result = await new LlmEvidenceReasoner(llm, observability).reason({ candidatePack: candidatePack() });

    expect(result.requirementCoverage[0].selections[0].evidence.claimText).toBe("Led architecture decisions across teams.");
    expect(result.recommendedEvidence).toHaveLength(2);
    expect(result.displayScore).toBe(78);
    expect(observability.traces[0].events).toEqual(["provider_completed", "validation_succeeded"]);
    expect(observability.traces[0].flushed).toBe(true);
  });

  it("falls back conservatively without repeating deterministic validation failures or mutating the candidate pack", async () => {
    const pack = candidatePack();
    const snapshot = JSON.stringify(pack);
    const observability = new RecordingObservability();
    const invalid = JSON.stringify({ ...JSON.parse(validOutput()), coverage: [{ ...JSON.parse(validOutput()).coverage[0], selections: [{ evidenceClaimId: "unknown", reason: "x", contribution: "x", exaggerationRisk: "low" }], rejections: [] }, JSON.parse(validOutput()).coverage[1] ] });
    const llm = provider(invalid);
    const fallback = await new LlmEvidenceReasoner(llm, observability).reason({ candidatePack: pack });
    expect(isDegradedEvidenceReasoningResult(fallback)).toBe(true);
    if (!isDegradedEvidenceReasoningResult(fallback)) throw new Error("Expected a degraded reasoning result.");
    expect(fallback.curatedEvidencePack).toMatchObject({
      overallCoverageSummary: expect.stringContaining("No model-derived evidence"),
      recommendedEvidence: []
    });
    expect(fallback.curatedEvidencePack.requirementCoverage.every((coverage) => coverage.coverageStatus === "missing")).toBe(true);
    expect(llm.generate).toHaveBeenCalledOnce();
    expect(JSON.stringify(pack)).toBe(snapshot);
    expect(observability.traces[0].events).toEqual(["provider_completed", "reasoning_fallback"]);
    expect(observability.traces[0].flushed).toBe(true);
    const malformed = provider("not json");
    const malformedFallback = await new LlmEvidenceReasoner(malformed, new RecordingObservability()).reason({ candidatePack: candidatePack() });
    expect(isDegradedEvidenceReasoningResult(malformedFallback)).toBe(true);
    expect(malformed.generate).toHaveBeenCalledOnce();
  });

  it("uses Ollama JSON Schema mode and expands the completion budget only after truncation", async () => {
    const llm = provider(validOutput());
    vi.mocked(llm.generate)
      .mockResolvedValueOnce({ content: validOutput(), provider: "ollama", model: "test-model", finishReason: "length" })
      .mockResolvedValueOnce({ content: validOutput(), provider: "ollama", model: "test-model" });
    await new LlmEvidenceReasoner(llm, new RecordingObservability()).reason({ candidatePack: candidatePack() });

    expect(llm.generate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      responseFormat: expect.objectContaining({ type: "object", additionalProperties: false }),
      disableThinking: true
    }));
    expect(llm.generate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      maxPredict: 8192,
      disableThinking: true
    }));
  });

  it("summarizes structured-output errors without retaining model-provided values", () => {
    const invalid = JSON.stringify({ ...JSON.parse(validOutput()), coverage: [{ ...JSON.parse(validOutput()).coverage[0], rejections: [{ evidenceClaimId: "claim-b", reason: "Not a valid rejection reason", explanation: "The model-provided value must not enter telemetry." }] }] });
    let error: unknown;
    try {
      parseEvidenceReasoningOutput(invalid, candidatePack());
    } catch (caught) {
      error = caught;
    }

    const diagnostic = describeEvidenceReasoningValidationError(error);
    expect(diagnostic).toMatchObject({
      errorCode: "invalid_structured_output",
      validationIssueCount: 1,
      validationIssues: "coverage[0].rejections[0].reason:invalid_enum_value"
    });
    expect(JSON.stringify(diagnostic)).not.toContain("Not a valid rejection reason");
  });

  it("accepts safe mirrored envelope fields and normalizes a missing scope alias", async () => {
    const output = JSON.parse(validOutput());
    output.contractVersion = "evidence-reasoner-v1";
    output.jobDescriptionId = "job-1";
    output.jobAnalysisId = "analysis-1";
    output.candidatePack = { hash: "input-only" };
    output.requirements = [];
    output.responseShape = { inputOnly: true };
    output.coverage[0].rejections[0].reason = "missing";

    const result = await new LlmEvidenceReasoner(provider(JSON.stringify(output)), new RecordingObservability()).reason({ candidatePack: candidatePack() });
    expect(result.requirementCoverage[0].rejections[0].reason).toBe("unsupported_scope");
  });

  it("retains the first repeated rejection and records a warning", async () => {
    const duplicateOutput = JSON.parse(validOutput());
    duplicateOutput.coverage.push({
      ...duplicateOutput.coverage[0],
      requirementId: "invented-requirement"
    });
    duplicateOutput.coverage[0].selections[0].complementaryEvidenceIds = ["claim-b", "claim-b", "claim-a"];
    duplicateOutput.coverage[0].rejections.push({
      ...duplicateOutput.coverage[0].rejections[0],
      reason: "weak",
      explanation: "A second model-generated rationale that must not replace the first."
    });
    const llm = provider(JSON.stringify(duplicateOutput));
    const result = await new LlmEvidenceReasoner(llm, new RecordingObservability()).reason({ candidatePack: candidatePack() });

    expect(result.requirementCoverage[0].rejections).toHaveLength(1);
    expect(result.requirementCoverage[0].rejections[0].reason).toBe("irrelevant");
    expect(result.requirementCoverage[0].selections[0].complementaryEvidenceIds).toBeUndefined();
    expect(result.warnings.join(" ")).toContain("repeated rejected evidence claim-b for requirement leadership");
    expect(result.warnings.join(" ")).toContain("invalid optional reference was removed");
    expect(result.warnings.join(" ")).toContain("unknown requirement invented-requirement");
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it("retains the first repeated requirement coverage and records a warning", async () => {
    const duplicateOutput = JSON.parse(validOutput());
    duplicateOutput.coverage.splice(1, 0, {
      ...duplicateOutput.coverage[0],
      coverageStatus: "weak",
      explanation: "A repeated decision that must not replace the first."
    });
    const llm = provider(JSON.stringify(duplicateOutput));

    const result = await new LlmEvidenceReasoner(llm, new RecordingObservability()).reason({ candidatePack: candidatePack() });

    expect(result.requirementCoverage).toHaveLength(2);
    expect(result.requirementCoverage[0].coverageStatus).toBe("partial");
    expect(result.warnings.join(" ")).toContain("repeated coverage for requirement leadership");
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it("keeps the model prompt compact and accepts a fenced JSON object", async () => {
    const pack = candidatePack();
    const prompt = JSON.parse(buildEvidenceReasoningUserPrompt(pack));
    expect(prompt.requirements[0].candidates[0]).not.toHaveProperty("sources");
    expect(prompt.requirements[0].candidates[0]).not.toHaveProperty("objectiveSignals");

    const result = await new LlmEvidenceReasoner(
      provider(`\`\`\`json\n${validOutput()}\n\`\`\``),
      new RecordingObservability()
    ).reason({ candidatePack: pack });
    expect(result.requirementCoverage).toHaveLength(2);
  });

  it("records an explicit missing decision when the model omits a requirement with candidates", async () => {
    const output = JSON.parse(validOutput());
    output.coverage = [output.coverage[0]];

    const result = await new LlmEvidenceReasoner(
      provider(JSON.stringify(output)),
      new RecordingObservability()
    ).reason({ candidatePack: candidatePack() });

    expect(result.requirementCoverage).toHaveLength(2);
    expect(result.requirementCoverage.find((coverage) => coverage.requirementId === "typescript")).toMatchObject({
      coverageStatus: "missing",
      selectedEvidenceIds: [],
      limitations: [expect.stringContaining("omitted a coverage decision")]
    });
    expect(result.warnings.join(" ")).toContain("omitted coverage for requirement typescript");
  });

  it("marks an empty Candidate Evidence Pack missing without calling the provider", async () => {
    const emptyPack = buildCandidateEvidencePack({
      jobDescription: jobDescription(),
      evidencePack: { ...evidencePack(), items: [] }
    });
    const llm = provider(validOutput());
    const observability = new RecordingObservability();
    const result = await new LlmEvidenceReasoner(llm, observability).reason({ candidatePack: emptyPack });

    expect(result.requirementCoverage.every((coverage) => coverage.coverageStatus === "missing")).toBe(true);
    expect(llm.generate).not.toHaveBeenCalled();
    expect(observability.traces[0].events).toEqual(["no_eligible_evidence"]);
  });

  it("removes redundant cross-requirement selections deterministically", () => {
    const pack = candidatePack();
    const evidence = pack.requirements[0].candidates[0];
    const coverage = ["required", "preferred"].map((importance, index) => ({
      requirementId: `r-${index}`,
      requirementText: `requirement ${index}`,
      importance: importance as "required" | "preferred",
      coverageStatus: "partial" as const,
      selectedEvidenceIds: [evidence.evidenceClaimId],
      rejectedCandidateEvidenceIds: [],
      selections: [{ evidenceClaimId: evidence.evidenceClaimId, reason: "direct", contribution: "same contribution", exaggerationRisk: "low" as const, evidence }],
      rejections: [],
      strengthFactors: [],
      limitations: [],
      explanation: "support"
    }));
    const result = deduplicateCrossRequirementSelections(coverage);
    expect(result[0].selections).toHaveLength(1);
    expect(result[1].selections).toHaveLength(0);
    expect(result[1].rejections[0].reason).toBe("redundant");
  });
});

describe("ReasonJobEvidence", () => {
  it("reuses an equivalent successful run without calling the provider twice", async () => {
    const document = jobDescription();
    const persisted: CuratedEvidencePack[] = [];
    const llm = provider(validOutput());
    const reasoner = new LlmEvidenceReasoner(llm, new RecordingObservability());
    const execute = createReasonJobEvidenceUseCase({
      jobDescriptionRepository: { hasJobDescriptionVersion: async () => false, findByVersion: async () => undefined, save: async () => undefined, findById: async () => document, list: async () => [document.job] },
      jobAnalysisRepository: { save: async () => undefined, findLatestByJobDescriptionId: async () => undefined, findByAnalysisIdentity: async () => undefined },
      candidateEvidencePackBuilder: { build: buildCandidateEvidencePack },
      curatedEvidencePackRepository: { save: async (pack) => { persisted.push(pack); }, findByRunIdentity: async (_jobId, runIdentity) => persisted.find((pack) => pack.runIdentity === runIdentity) },
      evidenceReasoner: reasoner
    }).execute;

    await execute({ jobDescriptionId: "job-1", evidencePack: evidencePack() });
    await execute({ jobDescriptionId: "job-1", evidencePack: evidencePack() });
    expect(persisted).toHaveLength(1);
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it("does not persist a conservative fallback, allowing a later valid provider response to recover", async () => {
    const document = jobDescription();
    const persisted: CuratedEvidencePack[] = [];
    const llm = provider("not json");
    const telemetry = new RecordingWorkflowTelemetry();
    const execute = createReasonJobEvidenceUseCase({
      jobDescriptionRepository: { hasJobDescriptionVersion: async () => false, findByVersion: async () => undefined, save: async () => undefined, findById: async () => document, list: async () => [document.job] },
      jobAnalysisRepository: { save: async () => undefined, findLatestByJobDescriptionId: async () => undefined, findByAnalysisIdentity: async () => undefined },
      candidateEvidencePackBuilder: { build: buildCandidateEvidencePack },
      curatedEvidencePackRepository: { save: async (pack) => { persisted.push(pack); }, findByRunIdentity: async (_jobId, runIdentity) => persisted.find((pack) => pack.runIdentity === runIdentity) },
      evidenceReasoner: new LlmEvidenceReasoner(llm, new RecordingObservability(), telemetry),
      telemetry
    }).execute;

    const fallback = await execute({ jobDescriptionId: "job-1", evidencePack: evidencePack() });
    expect(fallback.requirementCoverage.every((coverage) => coverage.coverageStatus === "missing")).toBe(true);
    expect(persisted).toHaveLength(0);
    expect(llm.generate).toHaveBeenCalledOnce();
    expect(telemetry.events).toHaveLength(1);
    expect(telemetry.events[0]).toMatchObject({
      name: "jobs.reason.command",
      severity: "error",
      attributes: expect.objectContaining({
        command: "jobs.reason",
        outcome: "degraded",
        degraded: true,
        error_code: "invalid_json",
        error_summary: "The model response was not valid JSON.",
        reasoning_attempts: 1,
        error_stack: expect.any(String)
      })
    });
  });

  it("round-trips validated immutable curated content through the persistence adapter", async () => {
    const curated = await new LlmEvidenceReasoner(provider(validOutput()), new RecordingObservability()).reason({ candidatePack: candidatePack() });
    const { id, runIdentity, jobDescriptionId, jobAnalysisId, candidatePackVersion, candidatePackHash, provider: providerName, model, promptVersion, createdAt, ...curatedEvidence } = curated;
    const values = vi.fn(async () => undefined);
    const repository = new DrizzleCuratedEvidencePackRepository({
      insert: vi.fn(() => ({ values })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id, runIdentity, jobDescriptionId, jobAnalysisId: jobAnalysisId ?? null, candidatePackVersion, candidatePackHash, provider: providerName, model, promptVersion, createdAt, curatedEvidence }])
          }))
        }))
      }))
    } as never);

    await repository.save(curated);
    await expect(repository.findByRunIdentity(curated.jobDescriptionId, curated.runIdentity)).resolves.toEqual(curated);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ candidatePackHash: curated.candidatePackHash, curatedEvidence }));
  });

  it("keeps a conservative fallback separate from the curated evidence domain", async () => {
    const fallback = await new LlmEvidenceReasoner(provider("not json"), new RecordingObservability()).reason({ candidatePack: candidatePack() });

    expect(isDegradedEvidenceReasoningResult(fallback)).toBe(true);
    if (!isDegradedEvidenceReasoningResult(fallback)) throw new Error("Expected a degraded reasoning result.");
    expect(fallback.fallbackDiagnostic.errorCode).toBe("invalid_json");
    expect(fallback.curatedEvidencePack).not.toHaveProperty("fallbackDiagnostic");
  });
});
