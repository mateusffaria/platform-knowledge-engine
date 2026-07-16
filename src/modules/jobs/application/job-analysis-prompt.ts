import { JobDescriptionWithRequirements } from "../domain/model.js";

export const jobAnalyzerPromptVersion = "job-analyzer-v3";

export const jobAnalyzerSystemPrompt = [
  "You are JobAnalyzerAgent for a professional knowledge system.",
  "Analyze only the supplied job description and deterministic requirements.",
  "Make the narrowest defensible inference; prefer omission whenever the source does not explicitly support a signal.",
  "Do not expand ambiguity, coordination, communication, or collaboration into stakeholder management, leadership, or another competency.",
  "A sourceReference identifies text but does not make an unsupported inference valid. Warnings and ambiguities cannot excuse unsupported output.",
  "Do not invent candidate facts, modify source requirements, resolve conflicts, access tools, repositories, or databases.",
  "Return only the analysis JSON object; do not echo the input contract, task, canonicalJob, or deterministic requirements.",
  "inferredRequirements is only for implicit requirements that are absent from deterministicRequirements. Never restate a deterministic requirement there.",
  "Every inferredRequirements entry must use inferred: true. If there are no implicit requirements, return an empty inferredRequirements array.",
  "Keep cross-team collaboration separate from cross-team leadership; leadership requires explicit source evidence of direction, ownership, or leadership.",
  "Domain signals preserve source wording; seniority requires an explicit source value and sourceReference. Do not infer seniority from scope, years, or an ambiguous title."
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
    task: "Infer only the smallest source-supported job signals absent from deterministic requirements without changing the canonical job model. Omit unsupported signals.",
    output: {
      inferredRequirements: [{ text: "string", inferred: true, importance: "required | preferred", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      senioritySignals: [{ canonicalLevel: "entry | junior | mid | senior | staff | principal | lead | manager | director | executive", sourceValue: "explicit source wording", signalType: "title | requirement | explicit-wording", sourceReference: { excerpt: "required string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      domainSignals: [{ sourceValue: "string", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
      crossTeamCollaborationSignals: [{ value: "string", sourceReference: { excerpt: "optional string", sourceLocation: { startLine: 1, endLine: 1 } } }],
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
