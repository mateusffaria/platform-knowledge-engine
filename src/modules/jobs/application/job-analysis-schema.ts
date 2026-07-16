import { z } from "zod";

import { JobAnalysisContent, JobAnalysisSignal, JobDescriptionWithRequirements } from "../domain/model.js";
import { normalizeDomainSignal } from "./job-analysis-normalizer.js";

const sourceLocationSchema = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive()
}).strict().refine((location) => location.endLine >= location.startLine, {
  message: "sourceLocation.endLine must be greater than or equal to sourceLocation.startLine"
});

const sourceReferenceSchema = z.object({
  excerpt: z.string().trim().min(1).optional(),
  sourceLocation: sourceLocationSchema.optional()
}).strict();

const signalSchema = z.object({
  value: z.string().trim().min(1),
  sourceReference: sourceReferenceSchema.optional()
}).strict();

const domainSignalSchema = z.object({
  sourceValue: z.string().trim().min(1),
  sourceReference: sourceReferenceSchema.optional()
}).strict();

const senioritySignalSchema = z.object({
  canonicalLevel: z.enum(["entry", "junior", "mid", "senior", "staff", "principal", "lead", "manager", "director", "executive"]),
  sourceValue: z.string().trim().min(1),
  signalType: z.enum(["title", "requirement", "explicit-wording"]),
  sourceReference: sourceReferenceSchema
}).strict();

const inferredRequirementSchema = z.object({
  text: z.string().trim().min(1),
  inferred: z.literal(true),
  importance: z.enum(["required", "preferred"]),
  sourceReference: sourceReferenceSchema.optional()
}).strict();

export const jobAnalysisOutputSchema = z.object({
  contractVersion: z.string().trim().min(1).optional(),
  inferredRequirements: z.array(inferredRequirementSchema),
  senioritySignals: z.array(senioritySignalSchema),
  domainSignals: z.array(domainSignalSchema),
  crossTeamCollaborationSignals: z.array(signalSchema),
  crossTeamLeadershipSignals: z.array(signalSchema),
  architectureAndReliabilityExpectations: z.array(signalSchema),
  ambiguities: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string().trim().min(1))
}).strip();

function validateSourceReferences(signals: Array<{ sourceReference?: JobAnalysisSignal["sourceReference"] }>, jobDescription: JobDescriptionWithRequirements): void {
  const lineCount = jobDescription.job.rawContent.split(/\r?\n/).length;
  for (const signal of signals) {
    const reference = signal.sourceReference;
    if (!reference) {
      continue;
    }
    if (reference.excerpt && !jobDescription.job.rawContent.includes(reference.excerpt)) {
      throw new Error("Job analysis source excerpt was not found in the canonical job source.");
    }
    if (reference.sourceLocation && reference.sourceLocation.endLine > lineCount) {
      throw new Error("Job analysis source location is outside the canonical job source.");
    }
  }
}

function validateConservativeInferenceBoundaries(content: JobAnalysisContent, jobDescription: JobDescriptionWithRequirements): void {
  const source = jobDescription.job.rawContent.toLocaleLowerCase("en-US");
  const sourceValues = [...content.senioritySignals, ...content.domainSignals];
  for (const signal of sourceValues) {
    if (!source.includes(signal.sourceValue.toLocaleLowerCase("en-US"))) {
      throw new Error("Job analysis signal source value was not found in the canonical job source.");
    }
  }
  const unsupportedStakeholderInference = content.inferredRequirements.some((requirement) =>
    /stakeholder[ -]?management/i.test(requirement.value) && !/stakeholder[ -]?management/i.test(source)
  );
  if (unsupportedStakeholderInference) {
    throw new Error("Job analysis included unsupported stakeholder-management inference.");
  }

  const hasExplicitLeadershipEvidence = /\bcross[- ]?team\b/i.test(source)
    && /\b(lead(?:ership)?|ownership|owner|direct(?:ing|ion)?|manag(?:e|ing|ement)|mentor(?:ing)?)\b/i.test(source);
  if (content.crossTeamLeadershipSignals.length > 0 && !hasExplicitLeadershipEvidence) {
    throw new Error("Job analysis included cross-team leadership without explicit leadership evidence.");
  }
}

export function parseJobAnalysisContent(content: string, jobDescription: JobDescriptionWithRequirements): JobAnalysisContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Job Analyzer returned output that was not valid JSON.", { cause: error });
  }

  const output = jobAnalysisOutputSchema.safeParse(parsed);
  if (!output.success) {
    throw new Error(`Job Analyzer returned invalid structured output: ${output.error.issues.map((issue) => issue.message).join("; ")}`);
  }

  const inferredRequirements = output.data.inferredRequirements.map((requirement, index) => ({
    id: `inferred-${index + 1}`,
    inferred: true as const,
    importance: requirement.importance,
    value: requirement.text,
    sourceReference: requirement.sourceReference
  }));
  const signals = [
    ...inferredRequirements,
    ...output.data.senioritySignals,
    ...output.data.domainSignals,
    ...output.data.crossTeamCollaborationSignals,
    ...output.data.crossTeamLeadershipSignals,
    ...output.data.architectureAndReliabilityExpectations
  ];
  validateSourceReferences(signals, jobDescription);
  const analysis: JobAnalysisContent = {
    inferredRequirements: inferredRequirements.map(({ value, ...requirement }) => ({ ...requirement, value })),
    senioritySignals: output.data.senioritySignals,
    domainSignals: output.data.domainSignals.map(normalizeDomainSignal),
    crossTeamCollaborationSignals: output.data.crossTeamCollaborationSignals,
    crossTeamLeadershipSignals: output.data.crossTeamLeadershipSignals,
    architectureAndReliabilityExpectations: output.data.architectureAndReliabilityExpectations,
    ambiguities: output.data.ambiguities,
    warnings: output.data.warnings
  };
  validateConservativeInferenceBoundaries(analysis, jobDescription);
  return analysis;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function legacySignals(value: unknown): JobAnalysisSignal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((signal) => {
    if (!isRecord(signal) || typeof signal.value !== "string") {
      return [];
    }
    return [{
      value: signal.value,
      sourceReference: isRecord(signal.sourceReference) ? signal.sourceReference as JobAnalysisSignal["sourceReference"] : undefined
    }];
  });
}

export function normalizeStoredJobAnalysisContent(content: unknown): JobAnalysisContent {
  if (!isRecord(content)) {
    throw new Error("Persisted job analysis content is invalid.");
  }
  if (Array.isArray(content.crossTeamCollaborationSignals)) {
    return content as unknown as JobAnalysisContent;
  }

  const inferredRequirements = legacySignals(content.inferredRequirements).flatMap((signal, index) => {
    const source = Array.isArray(content.inferredRequirements) ? content.inferredRequirements[index] : undefined;
    if (!isRecord(source) || source.inferred !== true || (source.importance !== "required" && source.importance !== "preferred")) {
      return [];
    }
    return [{ id: typeof source.id === "string" ? source.id : `inferred-${index + 1}`, inferred: true as const, importance: source.importance as "required" | "preferred", ...signal }];
  });
  const senioritySignals = legacySignals(content.senioritySignals).flatMap((signal) => {
    const level = signal.value.trim().toLocaleLowerCase("en-US").match(/\b(entry|junior|mid|senior|staff|principal|lead|manager|director|executive)\b/)?.[1];
    if (!level) {
      return [];
    }
    return [{ canonicalLevel: level as JobAnalysisContent["senioritySignals"][number]["canonicalLevel"], sourceValue: signal.value, signalType: "legacy-unclassified" as const, sourceReference: signal.sourceReference }];
  });
  const domainSignals = legacySignals(content.domainSignals).map((signal) => normalizeDomainSignal({ sourceValue: signal.value, sourceReference: signal.sourceReference }));

  return {
    inferredRequirements,
    senioritySignals,
    domainSignals,
    crossTeamCollaborationSignals: [],
    crossTeamLeadershipSignals: legacySignals(content.crossTeamLeadershipSignals),
    architectureAndReliabilityExpectations: legacySignals(content.architectureAndReliabilityExpectations),
    ambiguities: Array.isArray(content.ambiguities) ? content.ambiguities.filter((value): value is string => typeof value === "string") : [],
    warnings: Array.isArray(content.warnings) ? content.warnings.filter((value): value is string => typeof value === "string") : []
  };
}
