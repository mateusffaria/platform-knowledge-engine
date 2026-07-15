import { z } from "zod";

import { JobAnalysisContent, JobAnalysisSignal, JobDescriptionWithRequirements } from "../domain/model.js";
import { jobAnalyzerPromptVersion } from "./job-analysis-prompt.js";

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

const inferredRequirementSchema = z.object({
  text: z.string().trim().min(1),
  inferred: z.literal(true),
  importance: z.enum(["required", "preferred"]),
  sourceReference: sourceReferenceSchema.optional()
}).strict();

export const jobAnalysisOutputSchema = z.object({
  contractVersion: z.literal(jobAnalyzerPromptVersion).optional(),
  inferredRequirements: z.array(inferredRequirementSchema),
  senioritySignals: z.array(signalSchema),
  domainSignals: z.array(signalSchema),
  crossTeamLeadershipSignals: z.array(signalSchema),
  architectureAndReliabilityExpectations: z.array(signalSchema),
  ambiguities: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string().trim().min(1))
}).strip();

function validateSourceReferences(signals: JobAnalysisSignal[], jobDescription: JobDescriptionWithRequirements): void {
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
    ...output.data.crossTeamLeadershipSignals,
    ...output.data.architectureAndReliabilityExpectations
  ];
  validateSourceReferences(signals, jobDescription);

  return {
    inferredRequirements: inferredRequirements.map(({ value, ...requirement }) => ({ ...requirement, value })),
    senioritySignals: output.data.senioritySignals,
    domainSignals: output.data.domainSignals,
    crossTeamLeadershipSignals: output.data.crossTeamLeadershipSignals,
    architectureAndReliabilityExpectations: output.data.architectureAndReliabilityExpectations,
    ambiguities: output.data.ambiguities,
    warnings: output.data.warnings
  };
}
