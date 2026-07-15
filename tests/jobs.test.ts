import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import { JobDescriptionRepository } from "../src/modules/jobs/application/ports/job-description-repository.js";
import { createBuildJobRetrievalIntentUseCase } from "../src/modules/jobs/application/use-cases/build-job-retrieval-intent.js";
import { createIngestJobDescriptionUseCase } from "../src/modules/jobs/application/use-cases/ingest-job-description.js";
import { createShowJobDescriptionUseCase } from "../src/modules/jobs/application/use-cases/show-job-description.js";
import { JobDescriptionWithRequirements } from "../src/modules/jobs/domain/model.js";
import { DeterministicJobSourceParser, parseJobSource } from "../src/modules/jobs/infrastructure/parsers/deterministic-job-source-parser.js";
import { DrizzleJobDescriptionRepository } from "../src/modules/jobs/infrastructure/repositories/drizzle-job-description-repository.js";
import { registerJobsCommands } from "../src/modules/jobs/interfaces/cli/jobs-command.js";
import { EvidencePack } from "../src/modules/retrieval/application/types.js";

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
    const values = vi.fn(async () => undefined);
    const insert = vi.fn()
      .mockReturnValueOnce({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: document.job.id }])
          }))
        }))
      })
      .mockReturnValueOnce({ values });
    const transaction = vi.fn(async (handler: (tx: { insert: typeof insert }) => Promise<void>) => handler({ insert }));
    const repository = new DrizzleJobDescriptionRepository({ select: vi.fn(), transaction } as never);

    await repository.save(document);

    expect(transaction).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledOnce();
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
});

describe("jobs CLI commands", () => {
  const evidencePack: EvidencePack = {
    query: 'technology:"TypeScript" TypeScript',
    strategies: ["structured", "semantic"],
    generatedAt: new Date("2026-07-15T12:00:00.000Z"),
    warnings: [],
    items: []
  };

  function createProgram() {
    const document = makeJobDescription();
    const jobsServices = {
      ingestJobDescription: { execute: vi.fn(async () => ({ jobDescription: document, created: true })) },
      showJobDescription: { execute: vi.fn(async () => document) },
      analyzeJobDescription: { execute: vi.fn() },
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
      close: vi.fn(async () => undefined)
    };
    const retrievalServices = { hybridSearch: { execute: vi.fn(async () => evidencePack) }, close: vi.fn(async () => undefined) };
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
});
