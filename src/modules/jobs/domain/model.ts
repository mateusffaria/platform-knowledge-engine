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

export interface JobAnalysisSourceReference {
  excerpt?: string;
  sourceLocation?: JobSourceLocation;
}

export interface JobAnalysisSignal {
  value: string;
  sourceReference?: JobAnalysisSourceReference;
}

export interface JobAnalysisInferredRequirement extends JobAnalysisSignal {
  id: string;
  inferred: true;
  importance: JobRequirementImportance;
}

export interface JobAnalysisContent {
  inferredRequirements: JobAnalysisInferredRequirement[];
  senioritySignals: JobAnalysisSignal[];
  domainSignals: JobAnalysisSignal[];
  crossTeamLeadershipSignals: JobAnalysisSignal[];
  architectureAndReliabilityExpectations: JobAnalysisSignal[];
  ambiguities: string[];
  warnings: string[];
}

export interface JobAnalysis extends JobAnalysisContent {
  id: string;
  jobDescriptionId: string;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: Date;
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
  inferredAnalysisRequirementIds: string[];
  analysisId?: string;
  filters: JobPkqlFilter[];
  query: string;
  semanticText: string;
  warnings: string[];
}
