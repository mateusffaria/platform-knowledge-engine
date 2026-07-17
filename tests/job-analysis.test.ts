import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import { JobAnalysisRepository } from "../src/modules/jobs/application/ports/job-analysis-repository.js";
import { JobAnalysisObservability, JobAnalysisTrace } from "../src/modules/jobs/application/ports/job-analysis-observability.js";
import { LlmProvider } from "../src/modules/jobs/application/ports/llm-provider.js";
import { JobAnalyzerAgent } from "../src/modules/jobs/application/services/job-analyzer-agent.js";
import { createAnalyzeJobDescriptionUseCase } from "../src/modules/jobs/application/use-cases/analyze-job-description.js";
import { createBuildJobRetrievalIntentUseCase } from "../src/modules/jobs/application/use-cases/build-job-retrieval-intent.js";
import { JobAnalysis, JobDescriptionWithRequirements } from "../src/modules/jobs/domain/model.js";
import { LlmProviderFactory } from "../src/modules/jobs/infrastructure/llm-providers/llm-provider-factory.js";
import { MissingLlmProviderError } from "../src/modules/jobs/infrastructure/llm-providers/missing-llm-provider-error.js";
import { OllamaLlmProvider } from "../src/modules/jobs/infrastructure/llm-providers/ollama-llm-provider.js";
import { DrizzleJobAnalysisRepository } from "../src/modules/jobs/infrastructure/repositories/drizzle-job-analysis-repository.js";
import { LangfuseJobAnalysisObservability } from "../src/modules/jobs/infrastructure/observability/langfuse-job-analysis-observability.js";
import { registerJobsCommands } from "../src/modules/jobs/interfaces/cli/jobs-command.js";
import { AppConfig } from "../src/shared/config/env.js";
import { createLangfuseClient } from "../src/shared/observability/langfuse.js";
import { normalizeStoredJobAnalysisContent, parseJobAnalysisContent } from "../src/modules/jobs/application/job-analysis-schema.js";

function jobDescription(): JobDescriptionWithRequirements {
  return {
    job: {
      id: "job-1",
      sourceType: "markdown",
      sourcePath: "examples/job.md",
      rawContent: "# Staff Platform Engineer\n\n## Requirements\n- TypeScript\n- Lead reliable platform systems",
      contentHash: "hash-1",
      title: "Staff Platform Engineer",
      ingestedAt: new Date("2026-07-15T12:00:00.000Z")
    },
    requirements: [{
      id: "requirement-typescript",
      jobDescriptionId: "job-1",
      requirementType: "technology",
      importance: "required",
      normalizedValue: "TypeScript",
      originalText: "TypeScript",
      sourceExcerpt: "TypeScript",
      sourceLocation: { startLine: 4, endLine: 4 },
      sectionLabel: "Requirements",
      inferred: false
    }]
  };
}

function validAnalysisOutput() {
  return JSON.stringify({
    contractVersion: "job-analyzer-v3",
    inferredRequirements: [{
      text: "Experience leading platform reliability initiatives",
      inferred: true,
      importance: "required",
      sourceReference: { excerpt: "Lead reliable platform systems", sourceLocation: { startLine: 5, endLine: 5 } }
    }],
    senioritySignals: [{ canonicalLevel: "staff", sourceValue: "Staff", signalType: "title", sourceReference: { excerpt: "Staff Platform Engineer", sourceLocation: { startLine: 1, endLine: 1 } } }],
    domainSignals: [{ sourceValue: "Platform Engineer", sourceReference: { excerpt: "Platform Engineer" } }],
    crossTeamCollaborationSignals: [],
    crossTeamLeadershipSignals: [],
    architectureAndReliabilityExpectations: [{ value: "Reliable platform systems", sourceReference: { excerpt: "reliable platform systems" } }],
    ambiguities: ["No team size is specified."],
    warnings: []
  });
}

function providerWith(content: string): LlmProvider {
  return {
    resolveIdentity: (model) => ({ provider: "ollama", model: model ?? "llama3.2" }),
    generate: vi.fn(async () => ({ content, provider: "ollama", model: "llama3.2" }))
  };
}

class MemoryJobRepository {
  constructor(private readonly document?: JobDescriptionWithRequirements) {}

  async hasJobDescriptionVersion(): Promise<boolean> { return false; }
  async findByVersion(): Promise<JobDescriptionWithRequirements | undefined> { return undefined; }
  async save(): Promise<void> { return undefined; }
  async findById(id: string): Promise<JobDescriptionWithRequirements | undefined> {
    return this.document?.job.id === id ? this.document : undefined;
  }
  async list() { return this.document ? [this.document.job] : []; }
}

class MemoryAnalysisRepository implements JobAnalysisRepository {
  public saved: JobAnalysis[] = [];

  async save(analysis: JobAnalysis): Promise<void> {
    this.saved.push(analysis);
  }

  async findLatestByJobDescriptionId(jobDescriptionId: string): Promise<JobAnalysis | undefined> {
    return this.saved.filter((analysis) => analysis.jobDescriptionId === jobDescriptionId).at(-1);
  }

  async findByAnalysisIdentity(jobDescriptionId: string, analysisIdentity: string): Promise<JobAnalysis | undefined> {
    return this.saved.find((analysis) => analysis.jobDescriptionId === jobDescriptionId && analysis.analysisIdentity === analysisIdentity);
  }
}

class RecordingTrace implements JobAnalysisTrace {
  public events: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  public flushed = false;

  async event(name: string, properties?: Record<string, unknown>): Promise<void> {
    this.events.push({ name, properties });
  }

  async flush(): Promise<void> {
    this.flushed = true;
  }
}

class RecordingObservability implements JobAnalysisObservability {
  public traces: RecordingTrace[] = [];

  trace(): JobAnalysisTrace {
    const trace = new RecordingTrace();
    this.traces.push(trace);
    return trace;
  }
}

function appConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    databaseUrl: "postgres://localhost/pke",
    logLevel: "info",
    otelEnabled: false,
    ollamaBaseUrl: "http://localhost:11434",
    llmProvider: "ollama",
    llmModel: "llama3.2",
    ...overrides
  };
}

describe("LLM provider", () => {
  it("selects Ollama and supports a model override", async () => {
    const factory = new LlmProviderFactory();
    expect(factory.create(appConfig())).toBeInstanceOf(OllamaLlmProvider);

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ response: "{}", model: "override-model" }), { status: 200 }));
    const provider = new OllamaLlmProvider({ baseUrl: "http://ollama/", model: "configured-model", fetchImpl });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "override-model", responseFormat: "json" }))
      .resolves.toEqual({ content: "{}", provider: "ollama", model: "override-model" });
    expect(fetchImpl).toHaveBeenCalledWith("http://ollama/api/generate", expect.objectContaining({
      body: expect.stringContaining('"model":"override-model"')
    }));
  });

  it("fails clearly for configuration and transport problems", async () => {
    const factory = new LlmProviderFactory();
    expect(() => factory.create(appConfig({ llmProvider: undefined }))).toThrow(MissingLlmProviderError);
    expect(() => factory.create(appConfig({ llmProvider: "other" }))).toThrow('Unsupported LLM provider "other"');
    expect(() => factory.create(appConfig({ llmModel: undefined }))).toThrow("LLM_MODEL is required");

    const provider = new OllamaLlmProvider({
      baseUrl: "http://ollama",
      model: "configured-model",
      fetchImpl: async () => new Response("unavailable", { status: 503 })
    });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", responseFormat: "json" }))
      .rejects.toThrow("HTTP 503");
  });

  it("forwards JSON Schema, disabled thinking, and a recovery output budget to Ollama", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ response: "{}", model: "configured-model", done_reason: "stop" }), { status: 200 }));
    const provider = new OllamaLlmProvider({ baseUrl: "http://ollama", model: "configured-model", fetchImpl });

    await expect(provider.generate({
      systemPrompt: "system",
      userPrompt: "user",
      responseFormat: { type: "object", additionalProperties: false },
      disableThinking: true,
      maxPredict: 8192
    })).resolves.toMatchObject({ content: "{}", finishReason: "stop" });

    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      format: { type: "object", additionalProperties: false },
      think: false,
      options: { temperature: 0, num_predict: 8192 }
    });
  });
});

describe("Job Analyzer", () => {
  it("validates, traces, and persists source-aware inferred analysis without changing the job", async () => {
    const document = jobDescription();
    const provider = providerWith(validAnalysisOutput());
    const observability = new RecordingObservability();
    const analyses = new MemoryAnalysisRepository();
    const useCase = createAnalyzeJobDescriptionUseCase({
      jobDescriptionRepository: new MemoryJobRepository(document),
      jobAnalysisRepository: analyses,
      jobAnalyzer: new JobAnalyzerAgent(provider, observability)
    });

    const analysis = await useCase.execute({ jobDescriptionId: document.job.id });

    expect(analysis.inferredRequirements[0]).toMatchObject({ inferred: true, value: "Experience leading platform reliability initiatives" });
    expect(analyses.saved).toEqual([analysis]);
    expect(document.requirements).toHaveLength(1);
    expect(provider.generate).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining("Never restate a deterministic requirement")
    }));
    expect(observability.traces[0].events.map((event) => event.name)).toEqual(["provider_completed", "validation_succeeded"]);
    expect(observability.traces[0].flushed).toBe(true);
  });

  it("rejects invalid output, flushes tracing, and leaves prior analysis snapshots untouched", async () => {
    const document = jobDescription();
    const provider = providerWith("not json");
    const observability = new RecordingObservability();
    const analyses = new MemoryAnalysisRepository();
    const useCase = createAnalyzeJobDescriptionUseCase({
      jobDescriptionRepository: new MemoryJobRepository(document),
      jobAnalysisRepository: analyses,
      jobAnalyzer: new JobAnalyzerAgent(provider, observability)
    });

    await expect(useCase.execute({ jobDescriptionId: document.job.id })).rejects.toThrow("not valid JSON");
    expect(analyses.saved).toEqual([]);
    expect(document.requirements).toHaveLength(1);
    expect(observability.traces[0].events.map((event) => event.name)).toEqual(["provider_completed", "validation_failed"]);
    expect(observability.traces[0].flushed).toBe(true);
  });

  it("does not call the analyzer for an unknown job", async () => {
    const analyzer = { analyze: vi.fn() };
    const useCase = createAnalyzeJobDescriptionUseCase({
      jobDescriptionRepository: new MemoryJobRepository(),
      jobAnalysisRepository: new MemoryAnalysisRepository(),
      jobAnalyzer: analyzer
    });

    await expect(useCase.execute({ jobDescriptionId: "missing" })).rejects.toThrow("Job description not found: missing");
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("works with the no-op Langfuse implementation", async () => {
    const provider = providerWith(validAnalysisOutput());
    const analyzer = new JobAnalyzerAgent(provider, new LangfuseJobAnalysisObservability(createLangfuseClient({ captureContent: false })));

    await expect(analyzer.analyze({ jobDescription: jobDescription() })).resolves.toMatchObject({ promptVersion: "job-analyzer-v3" });
  });

  it("rejects unsupported stakeholder-management even with a valid source reference and warning", () => {
    const output = JSON.parse(validAnalysisOutput());
    output.inferredRequirements = [{
      text: "Stakeholder management",
      inferred: true,
      importance: "required",
      sourceReference: { excerpt: "Lead reliable platform systems", sourceLocation: { startLine: 5, endLine: 5 } }
    }];
    output.warnings = ["This is uncertain."];

    expect(() => parseJobAnalysisContent(JSON.stringify(output), jobDescription())).toThrow("unsupported stakeholder-management");
  });

  it("accepts a stale provider contract label when the payload itself satisfies v3", () => {
    const output = JSON.parse(validAnalysisOutput());
    output.contractVersion = "job-analyzer-v2";

    expect(parseJobAnalysisContent(JSON.stringify(output), jobDescription())).toMatchObject({
      senioritySignals: [expect.objectContaining({ canonicalLevel: "staff" })],
      crossTeamCollaborationSignals: []
    });
  });

  it("keeps collaboration and explicit cross-team leadership distinct in analysis and retrieval", async () => {
    const document = jobDescription();
    document.job.rawContent = "# Engineer\n- Partner with product and design teams\n- Lead cross-team platform delivery";
    const output = JSON.parse(validAnalysisOutput());
    output.inferredRequirements = [];
    output.senioritySignals = [];
    output.domainSignals = [];
    output.architectureAndReliabilityExpectations = [];
    output.crossTeamCollaborationSignals = [{ value: "Partner with product and design teams", sourceReference: { excerpt: "Partner with product and design teams", sourceLocation: { startLine: 2, endLine: 2 } } }];
    output.crossTeamLeadershipSignals = [{ value: "Lead cross-team platform delivery", sourceReference: { excerpt: "Lead cross-team platform delivery", sourceLocation: { startLine: 3, endLine: 3 } } }];

    const content = parseJobAnalysisContent(JSON.stringify(output), document);
    expect(content.crossTeamCollaborationSignals).toHaveLength(1);
    expect(content.crossTeamLeadershipSignals).toHaveLength(1);
    const analysis: JobAnalysis = {
      id: "analysis-collaboration",
      jobDescriptionId: document.job.id,
      provider: "ollama",
      model: "llama3.2",
      promptVersion: "job-analyzer-v3",
      createdAt: new Date(),
      ...content
    };
    const intent = await createBuildJobRetrievalIntentUseCase(new MemoryJobRepository(document), {
      save: async () => undefined,
      findLatestByJobDescriptionId: async () => analysis,
      findByAnalysisIdentity: async () => undefined
    }).execute({ jobDescriptionId: document.job.id });
    expect(intent.semanticText).toContain("Partner with product and design teams");
    expect(intent.semanticText).toContain("Lead cross-team platform delivery");
  });

  it("rejects cross-team leadership when the source supports collaboration only", () => {
    const document = jobDescription();
    document.job.rawContent = "# Engineer\n- Partner with cross-team product and design teams";
    const output = JSON.parse(validAnalysisOutput());
    output.inferredRequirements = [];
    output.senioritySignals = [];
    output.domainSignals = [];
    output.architectureAndReliabilityExpectations = [];
    output.crossTeamCollaborationSignals = [{ value: "Partner with cross-team product and design teams" }];
    output.crossTeamLeadershipSignals = [{ value: "Cross-team leadership" }];

    expect(() => parseJobAnalysisContent(JSON.stringify(output), document)).toThrow("cross-team leadership");
  });

  it("normalizes domain variations, preserves source wording, and omits absent seniority", () => {
    const document = jobDescription();
    document.job.rawContent = "# Engineer\n- Platform Engineers";
    const output = JSON.parse(validAnalysisOutput());
    output.inferredRequirements = [];
    output.senioritySignals = [];
    output.domainSignals = [{ sourceValue: "Platform Engineers" }];
    output.architectureAndReliabilityExpectations = [];

    const content = parseJobAnalysisContent(JSON.stringify(output), document);
    expect(content.domainSignals).toEqual([expect.objectContaining({ canonicalValue: "platform engineering", sourceValue: "Platform Engineers" })]);
    expect(content.senioritySignals).toEqual([]);
  });

  it("adapts legacy snapshots without inventing collaboration evidence", () => {
    const content = normalizeStoredJobAnalysisContent({
      inferredRequirements: [],
      senioritySignals: [{ value: "Staff-level scope", sourceReference: { excerpt: "Staff" } }],
      domainSignals: [{ value: "Platform Engineers" }],
      crossTeamLeadershipSignals: [{ value: "Lead platform work" }],
      architectureAndReliabilityExpectations: [],
      ambiguities: [],
      warnings: []
    });

    expect(content.senioritySignals).toEqual([expect.objectContaining({ canonicalLevel: "staff", signalType: "legacy-unclassified", sourceValue: "Staff-level scope" })]);
    expect(content.domainSignals).toEqual([expect.objectContaining({ canonicalValue: "platform engineering", sourceValue: "Platform Engineers" })]);
    expect(content.crossTeamCollaborationSignals).toEqual([]);
  });

  it("reuses an exact analysis identity and creates a new snapshot when the model changes", async () => {
    const document = jobDescription();
    const provider = providerWith(validAnalysisOutput());
    const analyses = new MemoryAnalysisRepository();
    const useCase = createAnalyzeJobDescriptionUseCase({
      jobDescriptionRepository: new MemoryJobRepository(document),
      jobAnalysisRepository: analyses,
      jobAnalyzer: new JobAnalyzerAgent(provider, new RecordingObservability())
    });

    const first = await useCase.execute({ jobDescriptionId: document.job.id });
    const repeated = await useCase.execute({ jobDescriptionId: document.job.id });
    const changedModel = await useCase.execute({ jobDescriptionId: document.job.id, model: "llama3.3" });
    expect(repeated.id).toBe(first.id);
    expect(changedModel.id).not.toBe(first.id);
    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(analyses.saved).toHaveLength(2);
  });

  it("returns the matching persisted snapshot after a concurrent identity conflict", async () => {
    const document = jobDescription();
    const provider = providerWith(validAnalysisOutput());
    const analyses = new MemoryAnalysisRepository();
    analyses.save = async (analysis) => {
      analyses.saved.push(analysis);
      throw new Error("duplicate analysis identity");
    };
    const useCase = createAnalyzeJobDescriptionUseCase({
      jobDescriptionRepository: new MemoryJobRepository(document),
      jobAnalysisRepository: analyses,
      jobAnalyzer: new JobAnalyzerAgent(provider, new RecordingObservability())
    });

    await expect(useCase.execute({ jobDescriptionId: document.job.id })).resolves.toMatchObject({ jobDescriptionId: document.job.id });
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
});

describe("Job analysis persistence and retrieval intent", () => {
  it("maps a persisted snapshot and uses analysis only as semantic enrichment", async () => {
    const document = jobDescription();
    const content = JSON.parse(validAnalysisOutput());
    const row = {
      id: "analysis-1",
      jobDescriptionId: document.job.id,
      provider: "ollama",
      model: "llama3.2",
      promptVersion: "job-analyzer-v3",
      analysisIdentity: "identity-1",
      createdAt: new Date("2026-07-15T13:00:00.000Z"),
      analysis: {
        ...content,
        inferredRequirements: content.inferredRequirements.map((requirement: { text: string; inferred: true; importance: "required" | "preferred"; sourceReference?: unknown }, index: number) => ({
          id: `inferred-${index + 1}`,
          inferred: requirement.inferred,
          importance: requirement.importance,
          value: requirement.text,
          sourceReference: requirement.sourceReference
        })),
        senioritySignals: [{ canonicalLevel: "staff", sourceValue: "Staff", signalType: "title", sourceReference: { excerpt: "Staff Platform Engineer" } }],
        domainSignals: [{ canonicalValue: "platform engineering", sourceValue: "Platform Engineer" }],
        crossTeamCollaborationSignals: []
      }
    };
    const values = vi.fn(async () => undefined);
    const insert = vi.fn(() => ({ values }));
    const limit = vi.fn(async () => [row]);
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit })), limit })) })) }));
    const repository = new DrizzleJobAnalysisRepository({ select, insert });
    await repository.save({ ...row, ...row.analysis } as JobAnalysis);
    await expect(repository.findLatestByJobDescriptionId(document.job.id)).resolves.toMatchObject({ id: "analysis-1", promptVersion: "job-analyzer-v3" });
    expect(values).toHaveBeenCalledOnce();

    const analysis: JobAnalysis = { ...row, ...row.analysis } as JobAnalysis;
    const intent = await createBuildJobRetrievalIntentUseCase(
      new MemoryJobRepository(document),
      { save: async () => undefined, findLatestByJobDescriptionId: async () => analysis, findByAnalysisIdentity: async () => undefined }
    ).execute({ jobDescriptionId: document.job.id });
    expect(intent.filters).toEqual([expect.objectContaining({ field: "technology", value: "TypeScript" })]);
    expect(intent.semanticText).toContain("Experience leading platform reliability initiatives");
    expect(intent.analysisId).toBe("analysis-1");
    expect(intent.inferredAnalysisRequirementIds).toEqual(["inferred-1"]);
    expect(intent.warnings).toContain("4 agent-inferred job analysis signal(s) are included in retrieval intent.");
  });
});

describe("jobs analyze CLI", () => {
  it("forwards options and supports JSON output", async () => {
    const document = jobDescription();
    const analysis: JobAnalysis = {
      id: "analysis-1",
      jobDescriptionId: document.job.id,
      provider: "ollama",
      model: "llama3.2",
      promptVersion: "job-analyzer-v3",
      createdAt: new Date("2026-07-15T13:00:00.000Z"),
      inferredRequirements: [], senioritySignals: [], domainSignals: [], crossTeamCollaborationSignals: [], crossTeamLeadershipSignals: [], architectureAndReliabilityExpectations: [], ambiguities: [], warnings: []
    };
    const analyze = vi.fn(async () => analysis);
    const services = {
      ingestJobDescription: { execute: vi.fn() },
      showJobDescription: { execute: vi.fn() },
      analyzeJobDescription: { execute: analyze },
      buildJobRetrievalIntent: { execute: vi.fn() },
      close: vi.fn(async () => undefined)
    };
    const retrievalServices = { hybridSearch: { execute: vi.fn() }, close: vi.fn(async () => undefined) };
    const program = new Command().exitOverride();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    registerJobsCommands(program, () => services, () => retrievalServices);

    await program.parseAsync(["node", "pke", "jobs", "analyze", "job-1", "--model", "override", "--json"]);
    expect(analyze).toHaveBeenCalledWith({ jobDescriptionId: "job-1", model: "override" });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ id: "analysis-1", model: "llama3.2" });
    await program.parseAsync(["node", "pke", "jobs", "analyze", "job-1", "--verbose"]);
    expect(log.mock.calls.some(([message]) => message.includes("provider=ollama model=llama3.2"))).toBe(true);
    log.mockRestore();
  });

  it("surfaces configuration and missing-job analysis errors", async () => {
    const analyze = vi.fn(async ({ jobDescriptionId }: { jobDescriptionId: string }) => {
      if (jobDescriptionId === "missing") {
        throw new Error("Job description not found: missing");
      }
      throw new MissingLlmProviderError("LLM_PROVIDER is required");
    });
    const services = {
      ingestJobDescription: { execute: vi.fn() },
      showJobDescription: { execute: vi.fn() },
      analyzeJobDescription: { execute: analyze },
      buildJobRetrievalIntent: { execute: vi.fn() },
      close: vi.fn(async () => undefined)
    };
    const program = new Command().exitOverride();
    registerJobsCommands(program, () => services, () => ({ hybridSearch: { execute: vi.fn() }, close: vi.fn(async () => undefined) }));

    await expect(program.parseAsync(["node", "pke", "jobs", "analyze", "job-1"])).rejects.toThrow("LLM_PROVIDER is required");
    await expect(program.parseAsync(["node", "pke", "jobs", "analyze", "missing"])).rejects.toThrow("Job description not found: missing");
    expect(services.close).toHaveBeenCalledTimes(2);
  });
});
