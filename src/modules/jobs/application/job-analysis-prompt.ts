import { JobDescriptionWithRequirements } from "../domain/model.js";

export const jobAnalyzerPromptVersion = "job-analyzer-v1";

export const jobAnalyzerSystemPrompt = [
  "You are JobAnalyzerAgent for a professional knowledge system.",
  "Analyze only the supplied job description and deterministic requirements.",
  "Do not invent candidate facts, modify source requirements, resolve conflicts, access tools, repositories, or databases.",
  "Return JSON only. Inferred requirements must be genuinely inferred and must use inferred: true.",
  "Use sourceReference excerpts or line ranges when they support a signal; omit sourceReference when no source reference is available."
].join(" ");

export function buildJobAnalyzerUserPrompt(jobDescription: JobDescriptionWithRequirements): string {
  const requirements = jobDescription.requirements.map((requirement) => ({
    id: requirement.id,
    requirementType: requirement.requirementType,
    importance: requirement.importance,
    originalText: requirement.originalText,
    sourceExcerpt: requirement.sourceExcerpt,
    sourceLocation: requirement.sourceLocation,
    sectionLabel: requirement.sectionLabel,
    inferred: requirement.inferred
  }));

  return JSON.stringify({
    contractVersion: jobAnalyzerPromptVersion,
    task: "Infer job signals without changing the canonical job model.",
    output: {
      inferredRequirements: [{ text: "string", inferred: true, importance: "required | preferred", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      senioritySignals: [{ value: "string", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      domainSignals: [{ value: "string", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      crossTeamLeadershipSignals: [{ value: "string", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      architectureAndReliabilityExpectations: [{ value: "string", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      ambiguities: ["string"],
      warnings: ["string"]
    },
    canonicalJob: {
      id: jobDescription.job.id,
      title: jobDescription.job.title,
      rawContent: jobDescription.job.rawContent,
      deterministicRequirements: requirements
    }
  }, null, 2);
}
