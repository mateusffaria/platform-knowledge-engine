export type JobSourceType = "markdown" | "plain_text";
export type JobRequirementType =
  | "skill"
  | "technology"
  | "experience"
  | "responsibility"
  | "seniority"
  | "domain"
  | "education"
  | "language";
export type JobRequirementImportance = "required" | "preferred";
export type JobPkqlFilterField = "skill" | "technology" | "role" | "project" | "type" | "status";

export interface JobSourceLocation {
  startLine: number;
  endLine: number;
}

export interface JobDescription {
  id: string;
  sourceType: JobSourceType;
  sourcePath: string;
  rawContent: string;
  contentHash: string;
  title?: string;
  ingestedAt: Date;
}

export interface JobRequirement {
  id: string;
  jobDescriptionId: string;
  requirementType: JobRequirementType;
  importance: JobRequirementImportance;
  normalizedValue?: string;
  originalText: string;
  sourceExcerpt: string;
  sourceLocation: JobSourceLocation;
  sectionLabel?: string;
  inferred: boolean;
}

export interface JobDescriptionWithRequirements {
  job: JobDescription;
  requirements: JobRequirement[];
}

export interface JobPkqlFilter {
  field: JobPkqlFilterField;
  value: string;
  sourceRequirementIds: string[];
}

export interface JobRetrievalIntent {
  jobDescriptionId: string;
  sourceRequirementIds: string[];
  inferredRequirementIds: string[];
  filters: JobPkqlFilter[];
  query: string;
  semanticText: string;
  warnings: string[];
}
