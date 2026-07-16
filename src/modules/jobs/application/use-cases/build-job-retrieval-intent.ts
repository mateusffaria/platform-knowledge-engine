import {
  JobPkqlFilter,
  JobPkqlFilterField,
  JobRequirement,
  JobRetrievalIntent
} from "../../domain/model.js";
import { JobAnalysisRepository } from "../ports/job-analysis-repository.js";
import { JobDescriptionRepository } from "../ports/job-description-repository.js";

function importanceRank(requirement: JobRequirement): number {
  if (requirement.importance === "required") {
    return requirement.inferred ? 1 : 0;
  }

  return requirement.inferred ? 3 : 2;
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function quotedPkqlValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function explicitFilter(requirement: JobRequirement): { field: JobPkqlFilterField; value: string } | undefined {
  if (requirement.normalizedValue && requirement.requirementType === "skill") {
    return { field: "skill", value: requirement.normalizedValue };
  }
  if (requirement.normalizedValue && requirement.requirementType === "technology") {
    return { field: "technology", value: requirement.normalizedValue };
  }

  const role = /^(?:role|position)\s*:\s*(.+)$/i.exec(requirement.originalText);
  if (requirement.requirementType === "seniority" && role?.[1]) {
    return { field: "role", value: role[1].trim() };
  }

  const compatible = /^(project|type|status)\s*:\s*(.+)$/i.exec(requirement.originalText);
  if (compatible?.[1] && compatible[2]) {
    return { field: compatible[1].toLowerCase() as JobPkqlFilterField, value: compatible[2].trim() };
  }

  return undefined;
}

export function createBuildJobRetrievalIntentUseCase(
  repository: JobDescriptionRepository,
  jobAnalysisRepository?: JobAnalysisRepository
) {
  return {
    async execute(command: { jobDescriptionId: string }): Promise<JobRetrievalIntent> {
      const jobDescription = await repository.findById(command.jobDescriptionId);
      if (!jobDescription) {
        throw new Error(`Job description not found: ${command.jobDescriptionId}`);
      }

      const requirements = [...jobDescription.requirements].sort((left, right) => {
        const rank = importanceRank(left) - importanceRank(right);
        return rank || left.sourceLocation.startLine - right.sourceLocation.startLine || left.id.localeCompare(right.id);
      });
      const sourceRequirementIds = requirements.map((requirement) => requirement.id);
      const inferredRequirementIds = requirements.filter((requirement) => requirement.inferred).map((requirement) => requirement.id);
      const analysis = await jobAnalysisRepository?.findLatestByJobDescriptionId(jobDescription.job.id);
      const inferredAnalysisRequirementIds = analysis?.inferredRequirements.map((requirement) => requirement.id) ?? [];
      const filterMap = new Map<string, JobPkqlFilter>();
      const semanticText: string[] = [];
      const semanticSeen = new Set<string>();

      for (const requirement of requirements) {
        const filter = explicitFilter(requirement);
        if (filter) {
          const key = `${filter.field}:${normalizeKey(filter.value)}`;
          const current = filterMap.get(key);
          if (current) {
            current.sourceRequirementIds.push(requirement.id);
          } else {
            filterMap.set(key, { ...filter, sourceRequirementIds: [requirement.id] });
          }
        }

        const semanticKey = normalizeKey(requirement.originalText);
        if (!semanticSeen.has(semanticKey)) {
          semanticSeen.add(semanticKey);
          semanticText.push(requirement.originalText);
        }
      }

      const analysisSignals = analysis ? [
        ...analysis.inferredRequirements.map((requirement) => requirement.value),
        ...analysis.senioritySignals.map((signal) => signal.canonicalLevel),
        ...analysis.domainSignals.map((signal) => signal.canonicalValue),
        ...analysis.crossTeamCollaborationSignals.map((signal) => signal.value),
        ...analysis.crossTeamLeadershipSignals.map((signal) => signal.value),
        ...analysis.architectureAndReliabilityExpectations.map((signal) => signal.value)
      ] : [];
      for (const signal of analysisSignals) {
        const semanticKey = normalizeKey(signal);
        if (!semanticSeen.has(semanticKey)) {
          semanticSeen.add(semanticKey);
          semanticText.push(signal);
        }
      }

      const filters = [...filterMap.values()];
      const query = [...filters.map((filter) => `${filter.field}:${quotedPkqlValue(filter.value)}`), ...semanticText].join(" ").trim();
      const warnings: string[] = [];
      if (filters.length === 0) {
        warnings.push("No job requirements mapped to canonical PKQL filters; retrieval will use semantic text.");
      }
      if (inferredRequirementIds.length > 0) {
        warnings.push(`${inferredRequirementIds.length} inferred job requirement signal(s) are included in retrieval intent.`);
      }
      if (analysisSignals.length > 0) {
        warnings.push(`${analysisSignals.length} agent-inferred job analysis signal(s) are included in retrieval intent.`);
      }

      return {
        jobDescriptionId: jobDescription.job.id,
        sourceRequirementIds,
        inferredRequirementIds,
        inferredAnalysisRequirementIds,
        analysisId: analysis?.id,
        filters,
        query,
        semanticText: semanticText.join(" "),
        warnings
      };
    }
  };
}
