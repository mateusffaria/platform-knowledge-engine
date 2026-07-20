import {
  boolean,
  jsonb,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector
} from "drizzle-orm/pg-core";

export const sourceDocumentType = pgEnum("source_document_type", ["markdown"]);
export const knowledgeAssetType = pgEnum("knowledge_asset_type", [
  "canonical-career-document",
  "professional_profile",
  "organization",
  "professional_experience",
  "role",
  "project",
  "initiative",
  "product",
  "education",
  "certification",
  "skill"
]);
export const evidenceClaimType = pgEnum("evidence_claim_type", [
  "skill",
  "experience",
  "project",
  "achievement"
]);
export const evidenceClaimCategory = pgEnum("evidence_claim_category", [
  "fact",
  "responsibility",
  "achievement",
  "metric",
  "capability",
  "relationship"
]);
export const evidenceClaimPredicate = pgEnum("evidence_claim_predicate", [
  "works_at",
  "holds_role",
  "uses_technology",
  "participated_in",
  "occurred_during",
  "reduced_processing_time",
  "reduced_cost",
  "improved_reliability",
  "demonstrates"
]);
export const evidenceClaimStatus = pgEnum("evidence_claim_status", [
  "confirmed",
  "single_source",
  "needs_review",
  "rejected",
  "superseded"
]);
export const conflictSeverity = pgEnum("conflict_severity", [
  "none",
  "low",
  "medium",
  "high"
]);
export const claimStatusTransitionSource = pgEnum("claim_status_transition_source", [
  "system",
  "user"
]);
export const embeddingSubjectType = pgEnum("embedding_subject_type", [
  "knowledge_asset",
  "evidence_claim"
]);
export const jobSourceType = pgEnum("job_source_type", ["markdown", "plain_text"]);
export const jobRequirementType = pgEnum("job_requirement_type", [
  "skill",
  "technology",
  "experience",
  "responsibility",
  "seniority",
  "domain",
  "education",
  "language"
]);
export const jobRequirementImportance = pgEnum("job_requirement_importance", ["required", "preferred"]);

export const embeddingDimensions = 768;

export const sourceDocuments = pgTable("source_documents", {
  id: uuid("id").primaryKey(),
  sourceType: sourceDocumentType("source_type").notNull(),
  path: text("path").notNull(),
  contentHash: text("content_hash").notNull(),
  sourceReliability: integer("source_reliability").notNull().default(50),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  rawContent: text("raw_content").notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull()
}, (table) => [
  index("source_documents_path_idx").on(table.path),
  uniqueIndex("source_documents_path_content_hash_unique").on(table.path, table.contentHash)
]);

export const knowledgeAssets = pgTable("knowledge_assets", {
  id: uuid("id").primaryKey(),
  sourceDocumentId: uuid("source_document_id")
    .notNull()
    .references(() => sourceDocuments.id, { onDelete: "cascade" }),
  assetType: knowledgeAssetType("asset_type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [
  index("knowledge_assets_source_document_id_idx").on(table.sourceDocumentId)
]);

export const sourceReferences = pgTable("source_references", {
  id: uuid("id").primaryKey(),
  sourceDocumentId: uuid("source_document_id")
    .notNull()
    .references(() => sourceDocuments.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  locator: text("locator").notNull(),
  excerpt: text("excerpt").notNull(),
  sourceLanguage: text("source_language"),
  originalSectionLabel: text("original_section_label").notNull().default("")
}, (table) => [
  index("source_references_source_document_id_idx").on(table.sourceDocumentId)
]);

export const evidenceClaims = pgTable("evidence_claims", {
  id: uuid("id").primaryKey(),
  subjectAssetId: uuid("subject_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  sourceReferenceId: uuid("source_reference_id")
    .notNull()
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  claimType: evidenceClaimType("claim_type").notNull(),
  claimCategory: evidenceClaimCategory("claim_category").notNull().default("fact"),
  predicate: evidenceClaimPredicate("predicate").notNull().default("demonstrates"),
  claimText: text("claim_text").notNull(),
  relatedAssetId: uuid("related_asset_id")
    .references(() => knowledgeAssets.id, { onDelete: "set null" }),
  valueText: text("value_text"),
  valueUnit: text("value_unit"),
  sourceLanguage: text("source_language"),
  originalSectionLabel: text("original_section_label").notNull().default(""),
  status: evidenceClaimStatus("status").notNull().default("single_source"),
  confidenceScore: integer("confidence_score").notNull().default(50),
  conflictSeverity: conflictSeverity("conflict_severity").notNull().default("none"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewReason: text("review_reason")
}, (table) => [
  index("evidence_claims_knowledge_asset_id_idx").on(table.knowledgeAssetId),
  index("evidence_claims_subject_asset_id_idx").on(table.subjectAssetId),
  index("evidence_claims_predicate_idx").on(table.predicate),
  index("evidence_claims_related_asset_id_idx").on(table.relatedAssetId)
]);

export const claimStatusEvents = pgTable("claim_status_events", {
  id: uuid("id").primaryKey(),
  evidenceClaimId: uuid("evidence_claim_id")
    .notNull()
    .references(() => evidenceClaims.id, { onDelete: "cascade" }),
  previousStatus: evidenceClaimStatus("previous_status"),
  nextStatus: evidenceClaimStatus("next_status").notNull(),
  reason: text("reason"),
  transitionSource: claimStatusTransitionSource("transition_source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [
  index("claim_status_events_evidence_claim_id_idx").on(table.evidenceClaimId)
]);

export const knowledgeEmbeddings = pgTable("knowledge_embeddings", {
  id: uuid("id").primaryKey(),
  subjectType: embeddingSubjectType("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  evidenceClaimId: uuid("evidence_claim_id")
    .references(() => evidenceClaims.id, { onDelete: "cascade" }),
  sourceDocumentId: uuid("source_document_id")
    .notNull()
    .references(() => sourceDocuments.id, { onDelete: "cascade" }),
  sourceReferenceId: uuid("source_reference_id")
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  embeddingText: text("embedding_text").notNull(),
  embeddingTextHash: text("embedding_text_hash").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  dimensions: integer("dimensions").notNull(),
  embedding: vector("embedding", { dimensions: embeddingDimensions }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => [
  index("knowledge_embeddings_subject_idx").on(table.subjectType, table.subjectId),
  index("knowledge_embeddings_knowledge_asset_id_idx").on(table.knowledgeAssetId),
  index("knowledge_embeddings_evidence_claim_id_idx").on(table.evidenceClaimId),
  index("knowledge_embeddings_source_reference_id_idx").on(table.sourceReferenceId),
  uniqueIndex("knowledge_embeddings_identity_unique").on(
    table.subjectType,
    table.subjectId,
    table.provider,
    table.model
  )
]);

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey(),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  evidenceClaimId: uuid("evidence_claim_id")
    .notNull()
    .references(() => evidenceClaims.id, { onDelete: "restrict" }),
  sourceReferenceId: uuid("source_reference_id")
    .notNull()
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  category: text("category")
});

export const jobDescriptions = pgTable("job_descriptions", {
  id: uuid("id").primaryKey(),
  sourceType: jobSourceType("source_type").notNull(),
  sourcePath: text("source_path").notNull(),
  rawContent: text("raw_content").notNull(),
  contentHash: text("content_hash").notNull(),
  title: text("title"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull()
}, (table) => [
  index("job_descriptions_source_path_idx").on(table.sourcePath),
  uniqueIndex("job_descriptions_source_path_content_hash_unique").on(table.sourcePath, table.contentHash)
]);

export const jobRequirements = pgTable("job_requirements", {
  id: uuid("id").primaryKey(),
  jobDescriptionId: uuid("job_description_id")
    .notNull()
    .references(() => jobDescriptions.id, { onDelete: "cascade" }),
  requirementType: jobRequirementType("requirement_type").notNull(),
  importance: jobRequirementImportance("importance").notNull(),
  normalizedValue: text("normalized_value"),
  originalText: text("original_text").notNull(),
  sourceExcerpt: text("source_excerpt").notNull(),
  sourceStartLine: integer("source_start_line").notNull(),
  sourceEndLine: integer("source_end_line").notNull(),
  sectionLabel: text("section_label"),
  inferred: boolean("inferred").notNull().default(false)
}, (table) => [
  index("job_requirements_job_description_id_idx").on(table.jobDescriptionId),
  index("job_requirements_type_normalized_value_idx").on(table.requirementType, table.normalizedValue),
  index("job_requirements_importance_idx").on(table.importance)
]);

export const jobAnalyses = pgTable("job_analyses", {
  id: uuid("id").primaryKey(),
  jobDescriptionId: uuid("job_description_id")
    .notNull()
    .references(() => jobDescriptions.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  analysisIdentity: text("analysis_identity"),
  analysis: jsonb("analysis").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [
  index("job_analyses_job_description_created_at_idx").on(table.jobDescriptionId, table.createdAt),
  uniqueIndex("job_analyses_job_description_analysis_identity_unique").on(table.jobDescriptionId, table.analysisIdentity)
]);

export const curatedEvidencePacks = pgTable("curated_evidence_packs", {
  id: uuid("id").primaryKey(),
  jobDescriptionId: uuid("job_description_id")
    .notNull()
    .references(() => jobDescriptions.id, { onDelete: "cascade" }),
  jobAnalysisId: uuid("job_analysis_id")
    .references(() => jobAnalyses.id, { onDelete: "set null" }),
  candidatePackVersion: text("candidate_pack_version").notNull(),
  candidatePackHash: text("candidate_pack_hash").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  runIdentity: text("run_identity").notNull(),
  curatedEvidence: jsonb("curated_evidence").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [
  index("curated_evidence_packs_job_description_created_at_idx").on(table.jobDescriptionId, table.createdAt),
  index("curated_evidence_packs_candidate_pack_hash_idx").on(table.candidatePackHash),
  uniqueIndex("curated_evidence_packs_job_description_run_identity_unique").on(table.jobDescriptionId, table.runIdentity)
]);

export const evaluationRuns = pgTable("evaluation_runs", {
  id: uuid("id").primaryKey(),
  datasetId: text("dataset_id").notNull(),
  datasetVersion: text("dataset_version").notNull(),
  datasetHash: text("dataset_hash").notNull(),
  requestedScenarioId: text("requested_scenario_id"),
  gitSha: text("git_sha").notNull(),
  provider: text("provider"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  candidatePackVersions: jsonb("candidate_pack_versions").$type<string[]>().notNull().default([]),
  status: text("status").notNull(),
  reportSchemaVersion: text("report_schema_version").notNull(),
  qualityMetrics: jsonb("quality_metrics").$type<Record<string, unknown>>().notNull(),
  performanceMetrics: jsonb("performance_metrics").$type<Record<string, unknown>>().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull()
}, (table) => [
  index("evaluation_runs_dataset_version_idx").on(table.datasetId, table.datasetVersion),
  index("evaluation_runs_completed_at_idx").on(table.completedAt)
]);

export const evaluationResults = pgTable("evaluation_results", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => evaluationRuns.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  assertions: jsonb("assertions").$type<Record<string, unknown>[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  observation: jsonb("observation").$type<Record<string, unknown>>(),
  diagnostic: jsonb("diagnostic").$type<Record<string, unknown>>()
}, (table) => [
  index("evaluation_results_run_id_idx").on(table.runId),
  uniqueIndex("evaluation_results_run_scenario_stage_unique").on(table.runId, table.scenarioId, table.stage)
]);

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey(),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  evidenceClaimId: uuid("evidence_claim_id")
    .notNull()
    .references(() => evidenceClaims.id, { onDelete: "restrict" }),
  sourceReferenceId: uuid("source_reference_id")
    .notNull()
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  role: text("role").notNull(),
  organization: text("organization"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description")
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  evidenceClaimId: uuid("evidence_claim_id")
    .notNull()
    .references(() => evidenceClaims.id, { onDelete: "restrict" }),
  sourceReferenceId: uuid("source_reference_id")
    .notNull()
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  technologies: jsonb("technologies").$type<string[]>().notNull().default([])
});

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey(),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  evidenceClaimId: uuid("evidence_claim_id")
    .notNull()
    .references(() => evidenceClaims.id, { onDelete: "restrict" }),
  sourceReferenceId: uuid("source_reference_id")
    .notNull()
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description")
});
