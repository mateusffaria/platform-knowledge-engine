import { Command } from "commander";

import { JobAnalysis, JobAnalysisDomainSignal, JobAnalysisSenioritySignal, JobAnalysisSignal, JobDescriptionWithRequirements, JobRetrievalIntent } from "../../domain/model.js";
import { EvidenceClaimStatus, EvidencePack, HybridSubjectType } from "../../../retrieval/application/types.js";

export interface JobsServices {
  ingestJobDescription: {
    execute(command: { sourcePath: string }): Promise<{ jobDescription: JobDescriptionWithRequirements; created: boolean }>;
  };
  showJobDescription: {
    execute(command: { jobDescriptionId: string }): Promise<JobDescriptionWithRequirements>;
  };
  analyzeJobDescription: {
    execute(command: { jobDescriptionId: string; model?: string }): Promise<JobAnalysis>;
  };
  buildJobRetrievalIntent: {
    execute(command: { jobDescriptionId: string }): Promise<JobRetrievalIntent>;
  };
  close(): Promise<void>;
}

export interface JobRetrievalServices {
  hybridSearch: {
    execute(command: {
      query: string;
      limit?: number;
      minScore?: number;
      claimStatus?: EvidenceClaimStatus;
      subjectType?: HybridSubjectType;
    }): Promise<EvidencePack>;
  };
  close(): Promise<void>;
}

export type JobsServicesFactory = () => JobsServices;
export type JobRetrievalServicesFactory = () => JobRetrievalServices;

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseOptionalScore(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Minimum score must be a finite number.");
  }
  return parsed;
}

function parseOptionalClaimStatus(value: string | undefined): EvidenceClaimStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "confirmed" && value !== "single_source") {
    throw new Error("Claim status filter must be confirmed or single_source for trusted retrieval.");
  }
  return value;
}

function parseOptionalSubjectType(value: string | undefined): HybridSubjectType | undefined {
  if (value === undefined) {
    return undefined;
  }
  const allowed = ["knowledge_asset", "evidence_claim", "skill", "experience", "project", "achievement"];
  if (!allowed.includes(value)) {
    throw new Error(`Unsupported subject type filter: ${value}.`);
  }
  return value as HybridSubjectType;
}

function printJobDescription(jobDescription: JobDescriptionWithRequirements, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(jobDescription, null, 2));
    return;
  }
  const { job, requirements } = jobDescription;
  console.log(`${job.id}${job.title ? ` ${job.title}` : ""}`);
  console.log(`source=${job.sourcePath} type=${job.sourceType}`);
  if (requirements.length === 0) {
    console.log("No requirements were extracted.");
    return;
  }
  for (const [index, requirement] of requirements.entries()) {
    const normalized = requirement.normalizedValue ? ` normalized=${requirement.normalizedValue}` : "";
    const inferred = requirement.inferred ? " inferred" : "";
    console.log(`${index + 1}. ${requirement.importance} ${requirement.requirementType}${normalized}${inferred}`);
    console.log(`   ${requirement.originalText}`);
    console.log(`   ${requirement.sectionLabel ?? "Unsectioned"} line:${requirement.sourceLocation.startLine}-${requirement.sourceLocation.endLine}`);
  }
}

function printSignal(label: string, signal: JobAnalysisSignal): void {
  const reference = signal.sourceReference;
  const location = reference?.sourceLocation
    ? ` line:${reference.sourceLocation.startLine}-${reference.sourceLocation.endLine}`
    : "";
  console.log(`   ${label}: ${signal.value}${location}`);
  if (reference?.excerpt) {
    console.log(`   source: ${reference.excerpt}`);
  }
}

function printDomainSignal(signal: JobAnalysisDomainSignal): void {
  const location = signal.sourceReference?.sourceLocation
    ? ` line:${signal.sourceReference.sourceLocation.startLine}-${signal.sourceReference.sourceLocation.endLine}`
    : "";
  console.log(`   domain: ${signal.canonicalValue} (source: ${signal.sourceValue})${location}`);
  if (signal.sourceReference?.excerpt) {
    console.log(`   source: ${signal.sourceReference.excerpt}`);
  }
}

function printSenioritySignal(signal: JobAnalysisSenioritySignal): void {
  const location = signal.sourceReference?.sourceLocation
    ? ` line:${signal.sourceReference.sourceLocation.startLine}-${signal.sourceReference.sourceLocation.endLine}`
    : "";
  console.log(`   seniority: ${signal.canonicalLevel} (source: ${signal.sourceValue}; type: ${signal.signalType})${location}`);
  if (signal.sourceReference?.excerpt) {
    console.log(`   source: ${signal.sourceReference.excerpt}`);
  }
}

function printJobAnalysis(analysis: JobAnalysis, options: { json?: boolean; verbose?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  console.log(`Job Analysis ${analysis.id} for ${analysis.jobDescriptionId}`);
  console.log(`provider=${analysis.provider} model=${analysis.model} prompt=${analysis.promptVersion}`);
  console.log(`inferred requirements=${analysis.inferredRequirements.length}`);
  if (options.verbose) {
    for (const requirement of analysis.inferredRequirements) {
      printSignal(`${requirement.importance} inferred requirement`, requirement);
    }
    for (const signal of analysis.senioritySignals) {
      printSenioritySignal(signal);
    }
    for (const signal of analysis.domainSignals) {
      printDomainSignal(signal);
    }
    for (const [label, signals] of [
      ["cross-team collaboration", analysis.crossTeamCollaborationSignals],
      ["cross-team leadership", analysis.crossTeamLeadershipSignals],
      ["architecture/reliability", analysis.architectureAndReliabilityExpectations]
    ] as const) {
      for (const signal of signals) {
        printSignal(label, signal);
      }
    }
  }
  for (const warning of [...analysis.ambiguities, ...analysis.warnings]) {
    console.log(`Warning: ${warning}`);
  }
}

function printEvidencePack(pack: EvidencePack, options: { json?: boolean; verbose?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(pack, null, 2));
    return;
  }
  console.log(`Evidence Pack for "${pack.query}" (${pack.strategies.join(", ")})`);
  if (pack.items.length === 0) {
    console.log(pack.warnings[0] ?? "No relevant eligible evidence was found.");
    return;
  }
  for (const [index, item] of pack.items.entries()) {
    console.log(`${index + 1}. ${item.subjectType} final=${item.finalScore.toFixed(4)} strategies=${item.retrievalStrategies.join(",")}`);
    console.log(`   ${item.claimText}`);
    if (options.verbose) {
      console.log(`   knowledgeAssetId=${item.knowledgeAssetId}`);
      if (item.evidenceClaimId) {
        console.log(`   evidenceClaimId=${item.evidenceClaimId}`);
      }
      for (const source of item.sources) {
        console.log(`   source=${source.sourcePath ?? source.sourceDocumentId} ${source.locator ?? ""} ${source.excerpt}`);
      }
    }
  }
  for (const warning of pack.warnings) {
    console.log(`Warning: ${warning}`);
  }
}

export function registerJobsCommands(
  program: Command,
  createJobsServices: JobsServicesFactory,
  createRetrievalServices: JobRetrievalServicesFactory
): void {
  const jobs = program.command("jobs").description("Ingest job descriptions and retrieve relevant professional evidence");

  jobs.command("ingest")
    .description("Ingest a Markdown or plain-text job description")
    .argument("<path>", "Path to a .md, .markdown, or .txt job description")
    .option("--json", "print machine-readable JSON")
    .action(async (sourcePath: string, options: { json?: boolean }) => {
      const services = createJobsServices();
      try {
        const result = await services.ingestJobDescription.execute({ sourcePath });
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.created) {
          console.log(`Ingested job description ${result.jobDescription.job.id}. Extracted ${result.jobDescription.requirements.length} requirement(s).`);
        } else {
          console.log(`Job description already ingested: ${result.jobDescription.job.id}.`);
        }
      } finally {
        await services.close();
      }
    });

  jobs.command("show")
    .description("Show a persisted job description and its extracted requirements")
    .argument("<job-id>", "job description id")
    .option("--json", "print machine-readable JSON")
    .action(async (jobDescriptionId: string, options: { json?: boolean }) => {
      const services = createJobsServices();
      try {
        printJobDescription(await services.showJobDescription.execute({ jobDescriptionId }), options.json ?? false);
      } finally {
        await services.close();
      }
    });

  jobs.command("analyze")
    .description("Analyze a persisted job description with the configured LLM")
    .argument("<job-id>", "job description id")
    .option("--model <model>", "override the configured LLM model for this analysis")
    .option("--json", "print machine-readable JSON")
    .option("--verbose", "include analysis source references and execution metadata")
    .action(async (jobDescriptionId: string, options: { model?: string; json?: boolean; verbose?: boolean }) => {
      const services = createJobsServices();
      try {
        const analysis = await services.analyzeJobDescription.execute({ jobDescriptionId, model: options.model });
        printJobAnalysis(analysis, options);
      } finally {
        await services.close();
      }
    });

  jobs.command("retrieve")
    .description("Retrieve a ranked Evidence Pack for a persisted job description")
    .argument("<job-id>", "job description id")
    .option("-l, --limit <number>", "maximum number of evidence items", "10")
    .option("--min-score <number>", "minimum final ranking score")
    .option("--claim-status <status>", "filter trusted evidence by claim status: confirmed or single_source")
    .option("--subject-type <type>", "filter by subject type: knowledge_asset, evidence_claim, skill, experience, project, achievement")
    .option("--verbose", "include identifiers and provenance")
    .option("--json", "print machine-readable JSON")
    .action(async (jobDescriptionId: string, options: {
      limit: string;
      minScore?: string;
      claimStatus?: string;
      subjectType?: string;
      verbose?: boolean;
      json?: boolean;
    }) => {
      const limit = parsePositiveInteger(options.limit, "Retrieval limit");
      const minScore = parseOptionalScore(options.minScore);
      const claimStatus = parseOptionalClaimStatus(options.claimStatus);
      const subjectType = parseOptionalSubjectType(options.subjectType);
      const jobsServices = createJobsServices();
      let retrievalServices: JobRetrievalServices | undefined;
      try {
        const intent = await jobsServices.buildJobRetrievalIntent.execute({ jobDescriptionId });
        retrievalServices = createRetrievalServices();
        const pack = await retrievalServices.hybridSearch.execute({
          query: intent.query,
          limit,
          minScore,
          claimStatus,
          subjectType
        });
        printEvidencePack(pack, options);
        if (!options.json) {
          for (const warning of intent.warnings) {
            console.log(`Job intent warning: ${warning}`);
          }
        }
      } finally {
        await retrievalServices?.close();
        await jobsServices.close();
      }
    });
}
