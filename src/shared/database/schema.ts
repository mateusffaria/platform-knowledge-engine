import {
  jsonb,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const sourceDocumentType = pgEnum("source_document_type", ["markdown"]);
export const knowledgeAssetType = pgEnum("knowledge_asset_type", ["canonical-career-document"]);
export const evidenceClaimType = pgEnum("evidence_claim_type", [
  "skill",
  "experience",
  "project",
  "achievement"
]);

export const sourceDocuments = pgTable("source_documents", {
  id: uuid("id").primaryKey(),
  sourceType: sourceDocumentType("source_type").notNull(),
  path: text("path").notNull(),
  contentHash: text("content_hash").notNull(),
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
  excerpt: text("excerpt").notNull()
}, (table) => [
  index("source_references_source_document_id_idx").on(table.sourceDocumentId)
]);

export const evidenceClaims = pgTable("evidence_claims", {
  id: uuid("id").primaryKey(),
  knowledgeAssetId: uuid("knowledge_asset_id")
    .notNull()
    .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
  sourceReferenceId: uuid("source_reference_id")
    .notNull()
    .references(() => sourceReferences.id, { onDelete: "restrict" }),
  claimType: evidenceClaimType("claim_type").notNull(),
  claimText: text("claim_text").notNull()
}, (table) => [
  index("evidence_claims_knowledge_asset_id_idx").on(table.knowledgeAssetId)
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
