import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { readFileSync } from "node:fs";

import { JobDescriptionRepository } from "../src/modules/jobs/application/ports/job-description-repository.js";
import { createBuildJobRetrievalIntentUseCase } from "../src/modules/jobs/application/use-cases/build-job-retrieval-intent.js";
import { createIngestJobDescriptionUseCase } from "../src/modules/jobs/application/use-cases/ingest-job-description.js";
import { createShowJobDescriptionUseCase } from "../src/modules/jobs/application/use-cases/show-job-description.js";
import { JobDescriptionWithRequirements } from "../src/modules/jobs/domain/model.js";
import { DeterministicJobSourceParser, parseJobSource } from "../src/modules/jobs/infrastructure/parsers/deterministic-job-source-parser.js";
import { DrizzleJobDescriptionRepository } from "../src/modules/jobs/infrastructure/repositories/drizzle-job-description-repository.js";
import { registerJobsCommands } from "../src/modules/jobs/interfaces/cli/jobs-command.js";
import { EvidencePack } from "../src/modules/retrieval/application/types.js";
import { atomicComponentsOf, normalizeWarnings, singletonAtomicRequirement, validateAtomicComponents } from "../src/modules/jobs/domain/atomic-job-requirement.js";

function makeJobDescription(): JobDescriptionWithRequirements {
  return {
    job: {
      id: "job-1",
      sourceType: "markdown",
      sourcePath: "examples/job.md",
      rawContent: "# Platform Engineer",
      contentHash: "hash-1",
      title: "Platform Engineer",
      ingestedAt: new Date("2026-07-15T12:00:00.000Z")
    },
    requirements: [
      {
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
      },
      {
        id: "requirement-react",
        jobDescriptionId: "job-1",
        requirementType: "technology",
        importance: "preferred",
        normalizedValue: "React",
        originalText: "React",
        sourceExcerpt: "React",
        sourceLocation: { startLine: 8, endLine: 8 },
        sectionLabel: "Nice to have",
        inferred: false
      },
      {
        id: "requirement-domain",
        jobDescriptionId: "job-1",
        requirementType: "domain",
        importance: "required",
        originalText: "Experience in fintech products",
        sourceExcerpt: "Experience in fintech products",
        sourceLocation: { startLine: 5, endLine: 5 },
        sectionLabel: "Requirements",
        inferred: false
      },
      {
        id: "requirement-inferred",
        jobDescriptionId: "job-1",
        requirementType: "skill",
        importance: "required",
        originalText: "Comfort working across ambiguous product areas",
        sourceExcerpt: "Comfort working across ambiguous product areas",
        sourceLocation: { startLine: 6, endLine: 6 },
        sectionLabel: "Requirements",
        inferred: true
      }
    ]
  };
}

class RecordingJobRepository implements JobDescriptionRepository {
  public saved: JobDescriptionWithRequirements[] = [];

  async hasJobDescriptionVersion(identity: { sourcePath: string; contentHash: string }): Promise<boolean> {
    return this.saved.some((item) => item.job.sourcePath === identity.sourcePath && item.job.contentHash === identity.contentHash);
  }

  async findByVersion(identity: { sourcePath: string; contentHash: string }): Promise<JobDescriptionWithRequirements | undefined> {
    return this.saved.find((item) => item.job.sourcePath === identity.sourcePath && item.job.contentHash === identity.contentHash);
  }

  async save(jobDescription: JobDescriptionWithRequirements): Promise<void> {
    this.saved.push(jobDescription);
  }

  async findById(jobDescriptionId: string): Promise<JobDescriptionWithRequirements | undefined> {
    return this.saved.find((item) => item.job.id === jobDescriptionId);
  }

  async list() {
    return this.saved.map((item) => item.job);
  }
}

describe("deterministic job parser", () => {
  it("extracts Markdown sections with requirement provenance and inferred signals", () => {
    const parsed = parseJobSource("examples/platform-engineer.md", [
      "# Platform Engineer",
      "",
      "## Requirements",
      "- TypeScript and PostgreSQL",
      "- 5 years of experience building backend systems",
      "- Comfort working across ambiguous product areas",
      "",
      "## Nice to have",
      "- React",
      "",
      "## Responsibilities",
      "- Design reliable developer platforms"
    ].join("\n"));

    expect(parsed.job.title).toBe("Platform Engineer");
    expect(parsed.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirementType: "technology",
        importance: "required",
        normalizedValue: "TypeScript",
        sourceLocation: { startLine: 4, endLine: 4 },
        sectionLabel: "Requirements",
        inferred: false
      }),
      expect.objectContaining({ requirementType: "experience", importance: "required", sourceLocation: { startLine: 5, endLine: 5 } }),
      expect.objectContaining({ requirementType: "technology", importance: "preferred", normalizedValue: "React", inferred: false }),
      expect.objectContaining({ requirementType: "responsibility", importance: "required", sectionLabel: "Responsibilities", inferred: false }),
      expect.objectContaining({ originalText: "Comfort working across ambiguous product areas", inferred: true })
    ]));
  });

  it("detects plain-text sections and retains paragraph requirements", () => {
    const parsed = parseJobSource("examples/platform-engineer.txt", [
      "Platform Engineer",
      "",
      "Requirements",
      "TypeScript experience is required for this role.",
      "",
      "Preferred Qualifications",
      "English fluency"
    ].join("\n"));

    expect(parsed.job.sourceType).toBe("plain_text");
    expect(parsed.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ requirementType: "technology", normalizedValue: "TypeScript", importance: "required", sourceLocation: { startLine: 4, endLine: 4 } }),
      expect.objectContaining({ requirementType: "language", importance: "preferred", sectionLabel: "Preferred Qualifications" })
    ]));
  });

  it.each([
    ["Strong knowledge of Go and PostgreSQL", ["Go", "PostgreSQL"]],
    ["Terraform and AWS", ["Terraform", "AWS"]],
    ["Docker and Kubernetes", ["Docker", "Kubernetes"]]
  ])("decomposes independently testable coordinated values in %s", (text, expected) => {
    const parsed = parseJobSource("examples/job.md", `## Requirements\n- ${text}`);
    const requirement = parsed.requirements[0];
    const components = atomicComponentsOf(requirement);
    expect(requirement.originalText).toBe(text);
    expect(components.map((component) => component.normalizedValue)).toEqual(expected);
    expect(components.map((component) => requirement.originalText.slice(component.sourceTextStart, component.sourceTextEnd))).toEqual(expected);
    expect(components.every((component) => component.jobRequirementId === requirement.id)).toBe(true);
  });

  it.each([
    "Design and build distributed systems",
    "Strong knowledge of Go and Rust",
    "Collaborate with product and design teams"
  ])("keeps non-atomic or unsupported coordination as a singleton: %s", (text) => {
    const section = text.startsWith("Design") || text.startsWith("Collaborate") ? "Responsibilities" : "Requirements";
    const requirement = parseJobSource("examples/job.md", `## ${section}\n- ${text}`).requirements[0];
    expect(atomicComponentsOf(requirement)).toHaveLength(1);
    expect(atomicComponentsOf(requirement)[0].originalText).toBe(text);
  });

  it("derives stable singleton identities without mutating a legacy requirement", () => {
    const requirement = makeJobDescription().requirements[0];
    const snapshot = structuredClone(requirement);
    expect(singletonAtomicRequirement(requirement).id).toBe(singletonAtomicRequirement(requirement).id);
    expect(requirement).toEqual(snapshot);
  });

  it("rejects invalid component provenance and preserves warnings with distinct codes", () => {
    const document = parseJobSource("compound.md", "## Requirements\n- Go and PostgreSQL");
    const requirement = document.requirements[0];
    requirement.components![0] = { ...requirement.components![0], sourceTextEnd: requirement.originalText.length + 1 };
    expect(() => validateAtomicComponents(requirement)).toThrow("invalid source span");
    expect(normalizeWarnings([
      { code: "retrieval_timeout", message: "Partial results." },
      { code: "canonical_hydration", message: "Partial results." },
      { code: "retrieval_timeout", message: "Partial results." }
    ])).toEqual([
      { code: "canonical_hydration", message: "Partial results." },
      { code: "retrieval_timeout", message: "Partial results." }
    ]);
  });

  it("rejects unsupported and empty sources before persistence", async () => {
    const parser = new DeterministicJobSourceParser();
    await expect(parser.parse("examples/job.pdf")).rejects.toThrow("Only Markdown");
    expect(() => parseJobSource("examples/job.md", " \n")).toThrow("must not be empty");
  });
});

describe("job application use cases", () => {
  it("ingests only a new source version and reports unknown jobs clearly", async () => {
    const repository = new RecordingJobRepository();
    const document = makeJobDescription();
    const parser = { parse: vi.fn(async () => document) };
    const ingest = createIngestJobDescriptionUseCase({ parser, repository });

    await expect(ingest.execute({ sourcePath: "examples/job.pdf" })).rejects.toThrow("Only Markdown");
    expect((await ingest.execute({ sourcePath: "examples/job.md" })).created).toBe(true);
    expect((await ingest.execute({ sourcePath: "examples/job.md" })).created).toBe(false);
    expect(repository.saved).toHaveLength(1);
    await expect(createShowJobDescriptionUseCase(repository).execute({ jobDescriptionId: "missing" })).rejects.toThrow("Job description not found: missing");
  });

  it("returns the persisted job identifier when an identical source is already ingested", async () => {
    const repository = new RecordingJobRepository();
    const persisted = makeJobDescription();
    await repository.save(persisted);
    const parsedAgain: JobDescriptionWithRequirements = {
      ...persisted,
      job: { ...persisted.job, id: "temporary-parser-id" },
      requirements: persisted.requirements.map((requirement) => ({ ...requirement, id: `temporary-${requirement.id}`, jobDescriptionId: "temporary-parser-id" }))
    };
    const ingest = createIngestJobDescriptionUseCase({
      parser: { parse: vi.fn(async () => parsedAgain) },
      repository
    });

    const result = await ingest.execute({ sourcePath: persisted.job.sourcePath });

    expect(result).toEqual({ jobDescription: persisted, created: false });
    expect(result.jobDescription.job.id).toBe("job-1");
    expect(repository.saved).toHaveLength(1);
  });

  it("persists the job and all of its requirements in one transaction", async () => {
    const document = makeJobDescription();
    const requirementValues = vi.fn(async () => undefined);
    const componentValues = vi.fn(async () => undefined);
    const insert = vi.fn()
      .mockReturnValueOnce({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: document.job.id }])
          }))
        }))
      })
      .mockReturnValueOnce({ values: requirementValues })
      .mockReturnValueOnce({ values: componentValues });
    const transaction = vi.fn(async (handler: (tx: { insert: typeof insert }) => Promise<void>) => handler({ insert }));
    const repository = new DrizzleJobDescriptionRepository({ select: vi.fn(), transaction } as never);

    await repository.save(document);

    expect(transaction).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledTimes(3);
    expect(requirementValues).toHaveBeenCalledOnce();
    expect(componentValues).toHaveBeenCalledOnce();
    expect(componentValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ jobRequirementId: "requirement-typescript", componentIndex: 0, originalText: "TypeScript" })
    ]));
  });

  it("loads stored components in source order and adapts legacy rows without writing", async () => {
    const parsed = parseJobSource("compound.md", "## Requirements\n- Go and PostgreSQL");
    const requirement = parsed.requirements[0];
    const requirementRow = {
      id: requirement.id,
      jobDescriptionId: parsed.job.id,
      requirementType: requirement.requirementType,
      importance: requirement.importance,
      normalizedValue: requirement.normalizedValue ?? null,
      originalText: requirement.originalText,
      sourceExcerpt: requirement.sourceExcerpt,
      sourceStartLine: requirement.sourceLocation.startLine,
      sourceEndLine: requirement.sourceLocation.endLine,
      sectionLabel: requirement.sectionLabel ?? null,
      inferred: requirement.inferred
    };
    const componentRows = atomicComponentsOf(requirement).map((component) => ({
      id: component.id,
      jobRequirementId: component.jobRequirementId,
      componentIndex: component.componentIndex,
      originalText: component.originalText,
      requirementType: component.requirementType,
      importance: component.importance,
      normalizedValue: component.normalizedValue ?? null,
      sourceExcerpt: component.sourceExcerpt,
      sourceStartLine: component.sourceLocation.startLine,
      sourceEndLine: component.sourceLocation.endLine,
      sourceTextStart: component.sourceTextStart,
      sourceTextEnd: component.sourceTextEnd
    })).reverse();
    const database = (storedComponents: typeof componentRows) => {
      let phase = 0;
      return {
        select: vi.fn(() => {
          const current = phase++ % 3;
          if (current === 0) return { from: () => ({ where: () => ({ limit: async () => [parsed.job] }) }) };
          if (current === 1) return { from: () => ({ where: () => ({ orderBy: async () => [requirementRow] }) }) };
          return { from: () => ({ where: () => ({ orderBy: async () => storedComponents }) }) };
        }),
        transaction: vi.fn()
      };
    };

    const stored = await new DrizzleJobDescriptionRepository(database(componentRows) as never).findById(parsed.job.id);
    expect(stored?.requirements[0].components?.map((component) => component.originalText)).toEqual(["Go", "PostgreSQL"]);

    const legacyDb = database([]);
    const legacyRepository = new DrizzleJobDescriptionRepository(legacyDb as never);
    const first = await legacyRepository.findById(parsed.job.id);
    const second = await legacyRepository.findById(parsed.job.id);
    expect(first?.requirements[0].components).toEqual(second?.requirements[0].components);
    expect(first?.requirements[0].components).toHaveLength(1);
    expect(legacyDb.transaction).not.toHaveBeenCalled();
  });

  it("keeps the atomic-component migration additive and leaves parent rows untouched", () => {
    const migration = readFileSync(new URL("../drizzle/0012_add_job_requirement_components.sql", import.meta.url), "utf8");
    expect(migration).toContain('CREATE TABLE "job_requirement_components"');
    expect(migration).toContain('UNIQUE INDEX "job_requirement_components_requirement_order_unique"');
    expect(migration).toContain('REFERENCES "public"."job_requirements"("id") ON DELETE cascade');
    expect(migration).not.toContain('ALTER TABLE "job_requirements"');
    expect(migration).not.toMatch(/^(?:DROP|UPDATE|DELETE)\b/m);
  });

  it("builds a deterministic, deduplicated intent with semantic fallback and traceability", async () => {
    const repository = new RecordingJobRepository();
    const document = makeJobDescription();
    document.requirements.push({ ...document.requirements[0], id: "requirement-typescript-duplicate", sourceLocation: { startLine: 7, endLine: 7 } });
    await repository.save(document);
    const buildIntent = createBuildJobRetrievalIntentUseCase(repository);

    const first = await buildIntent.execute({ jobDescriptionId: "job-1" });
    const second = await buildIntent.execute({ jobDescriptionId: "job-1" });

    expect(first).toEqual(second);
    expect(first.filters).toEqual([
      expect.objectContaining({ field: "technology", value: "TypeScript", sourceRequirementIds: ["requirement-typescript", "requirement-typescript-duplicate"] }),
      expect.objectContaining({ field: "technology", value: "React" })
    ]);
    expect(first.query).toContain('technology:"TypeScript"');
    expect(first.semanticText).toContain("Experience in fintech products");
    expect(first.semanticText.indexOf("TypeScript")).toBeLessThan(first.semanticText.indexOf("React"));
    expect(first.inferredRequirementIds).toEqual(["requirement-inferred"]);
    expect(first.warnings).toContain("1 inferred job requirement signal(s) are included in retrieval intent.");
    await expect(buildIntent.execute({ jobDescriptionId: "missing" })).rejects.toThrow("Job description not found: missing");
  });

  it("builds ordered component retrieval intents while retaining the parent requirement", async () => {
    const repository = new RecordingJobRepository();
    const document = parseJobSource("compound.md", "## Requirements\n- Strong knowledge of Go and PostgreSQL");
    await repository.save(document);

    const intent = await createBuildJobRetrievalIntentUseCase(repository).execute({ jobDescriptionId: document.job.id });
    const components = atomicComponentsOf(document.requirements[0]);
    expect(intent.sourceRequirementIds).toEqual([document.requirements[0].id]);
    expect(intent.componentIntents).toEqual([
      expect.objectContaining({ requirementId: document.requirements[0].id, componentId: components[0].id, componentText: "Go", query: 'technology:"Go" Go' }),
      expect.objectContaining({ requirementId: document.requirements[0].id, componentId: components[1].id, componentText: "PostgreSQL", query: 'technology:"PostgreSQL" PostgreSQL' })
    ]);
    expect(intent.filters.map((filter) => [filter.value, filter.sourceComponentIds])).toEqual([["Go", [components[0].id]], ["PostgreSQL", [components[1].id]]]);
  });
});

describe("jobs CLI commands", () => {
  const evidencePack: EvidencePack = {
    query: 'technology:"TypeScript" TypeScript',
    strategies: ["structured", "semantic"],
    generatedAt: new Date("2026-07-15T12:00:00.000Z"),
    warnings: [],
    items: [],
    diagnostics: {
      rawStructuredResultCount: 0,
      rawSemanticResultCount: 0,
      rawResults: [],
      eligibleResults: [],
      discardedResults: []
    }
  };
  const curatedEvidencePack = {
    id: "curated-1",
    runIdentity: "run-1",
    jobDescriptionId: "job-1",
    candidatePackVersion: "candidate-evidence-pack-v3",
    candidatePackHash: "pack-hash",
    provider: "ollama",
    model: "test-model",
    promptVersion: "evidence-reasoner-v8",
    createdAt: new Date("2026-07-16T00:00:00.000Z"),
    overallCoverageSummary: "Partial coverage.",
    requirementCoverage: [],
    recommendedEvidence: [],
    discardedEvidence: [],
    missingEvidence: [],
    warnings: [],
    limitations: []
  };

  function createProgram() {
    const document = makeJobDescription();
    const jobsServices = {
      ingestJobDescription: { execute: vi.fn(async () => ({ jobDescription: document, created: true })) },
      showJobDescription: { execute: vi.fn(async () => document) },
      analyzeJobDescription: { execute: vi.fn(async () => ({ id: "analysis-forced" })) },
      buildJobRetrievalIntent: { execute: vi.fn(async () => ({
        jobDescriptionId: document.job.id,
        sourceRequirementIds: document.requirements.map((item) => item.id),
        inferredRequirementIds: ["requirement-inferred"],
        inferredAnalysisRequirementIds: [],
        filters: [{ field: "technology" as const, value: "TypeScript", sourceRequirementIds: ["requirement-typescript"] }],
        query: evidencePack.query,
        semanticText: "TypeScript",
        warnings: []
      })) },
      reasonJobEvidence: { execute: vi.fn(async () => curatedEvidencePack) },
      close: vi.fn(async () => undefined)
    };
    const retrievalServices = {
      hybridSearch: { execute: vi.fn(async () => evidencePack) },
      canonicalEvidenceReader: { read: vi.fn() },
      close: vi.fn(async () => undefined)
    };
    const program = new Command();
    program.exitOverride();
    registerJobsCommands(program, () => jobsServices, () => retrievalServices);
    return { program, jobsServices, retrievalServices };
  }

  it("supports ingest and show JSON output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { program } = createProgram();
    await program.parseAsync(["node", "pke", "jobs", "ingest", "examples/job.md", "--json"]);
    expect(JSON.parse(log.mock.calls[0][0]).created).toBe(true);
    await program.parseAsync(["node", "pke", "jobs", "show", "job-1", "--json"]);
    expect(JSON.parse(log.mock.calls[1][0]).job.id).toBe("job-1");
    log.mockRestore();
  });

  it("passes existing retrieval options through unchanged", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { program, retrievalServices } = createProgram();
    await program.parseAsync(["node", "pke", "jobs", "retrieve", "job-1", "--limit", "3", "--min-score", "0.7", "--claim-status", "confirmed", "--subject-type", "skill"]);
    expect(retrievalServices.hybridSearch.execute).toHaveBeenCalledWith({
      query: evidencePack.query,
      limit: 3,
      minScore: 0.7,
      claimStatus: "confirmed",
      subjectType: "skill"
    });
    log.mockRestore();
  });

  it("uses the same validation semantics as retrieve", async () => {
    const { program } = createProgram();
    await expect(program.parseAsync(["node", "pke", "jobs", "retrieve", "job-1", "--claim-status", "rejected"])).rejects.toThrow("Claim status filter must be confirmed or single_source");
  });

  it("prints concise candidate summaries by default and retains full diagnostics in JSON or verbose output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { program } = createProgram();
    await program.parseAsync(["node", "pke", "jobs", "candidates", "job-1", "--json"]);
    const pack = JSON.parse(log.mock.calls[0][0]);
    expect(pack.selection).toEqual({ limitPerRequirement: 3 });
    expect(pack.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirementId: "requirement-typescript",
        diagnostics: expect.objectContaining({ rawRetrievalResultCount: 0, requirementAssociationCount: 0 })
      })
    ]));
    log.mockClear();
    await program.parseAsync(["node", "pke", "jobs", "candidates", "job-1"]);
    const concise = log.mock.calls.flat().join("\n");
    expect(concise).toContain("selected-for-reasoner=0");
    expect(concise).not.toContain("counts: raw=retrieval subjects");
    log.mockClear();
    await program.parseAsync(["node", "pke", "jobs", "candidates", "job-1", "--verbose"]);
    expect(log.mock.calls.flat().join("\n")).toContain("counts: raw=retrieval subjects");
    log.mockRestore();
  });

  it("validates candidate selection options and passes the same selection to reasoning", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { program, jobsServices } = createProgram();
    await expect(program.parseAsync(["node", "pke", "jobs", "candidates", "job-1", "--limit-per-requirement", "0"])).rejects.toThrow("Candidate limit per requirement must be a positive integer");
    await program.parseAsync(["node", "pke", "jobs", "reason", "job-1", "--limit-per-requirement", "3", "--min-candidate-score", "0.7"]);
    expect(jobsServices.reasonJobEvidence.execute).toHaveBeenCalledWith(expect.objectContaining({
      candidatePack: expect.objectContaining({ selection: { limitPerRequirement: 3, minCandidateScore: 0.7 } })
    }));
    log.mockRestore();
  });

  it("curates retrieved evidence with model override and supports JSON output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { program, jobsServices, retrievalServices } = createProgram();
    await program.parseAsync(["node", "pke", "jobs", "reason", "job-1", "--model", "override-model", "--json"]);

    expect(retrievalServices.hybridSearch.execute).toHaveBeenCalledTimes(3);
    expect(jobsServices.reasonJobEvidence.execute).toHaveBeenCalledWith(expect.objectContaining({
      jobDescriptionId: "job-1",
      candidatePack: expect.objectContaining({
        requirements: expect.arrayContaining([expect.objectContaining({ requirementId: "requirement-typescript" })])
      }),
      model: "override-model"
    }));
    expect(JSON.parse(log.mock.calls[0][0]).promptVersion).toBe("evidence-reasoner-v8");
    log.mockRestore();
  });

  it("propagates force to generation caches and refreshes analysis dependencies", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const analyzed = createProgram();
    await analyzed.program.parseAsync(["node", "pke", "jobs", "analyze", "job-1", "--force", "--json"]);
    expect(analyzed.jobsServices.analyzeJobDescription.execute).toHaveBeenCalledWith({ jobDescriptionId: "job-1", force: true });

    const reasoned = createProgram();
    await reasoned.program.parseAsync(["node", "pke", "jobs", "reason", "job-1", "--force", "--json"]);
    expect(reasoned.jobsServices.reasonJobEvidence.execute).toHaveBeenCalledWith(expect.objectContaining({ force: true }));

    const candidates = createProgram();
    await candidates.program.parseAsync(["node", "pke", "jobs", "candidates", "job-1", "--force", "--json"]);
    expect(candidates.jobsServices.analyzeJobDescription.execute).toHaveBeenCalledWith({ jobDescriptionId: "job-1", force: true });

    const retrieved = createProgram();
    await retrieved.program.parseAsync(["node", "pke", "jobs", "retrieve", "job-1", "--force", "--json"]);
    expect(retrieved.jobsServices.analyzeJobDescription.execute).toHaveBeenCalledWith({ jobDescriptionId: "job-1", force: true });
    log.mockRestore();
  });
});
