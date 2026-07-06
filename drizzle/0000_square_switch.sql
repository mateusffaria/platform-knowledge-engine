CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."evidence_claim_type" AS ENUM('skill', 'experience', 'project', 'achievement');--> statement-breakpoint
CREATE TYPE "public"."knowledge_asset_type" AS ENUM('canonical-career-document');--> statement-breakpoint
CREATE TYPE "public"."source_document_type" AS ENUM('markdown');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"knowledge_asset_id" uuid NOT NULL,
	"evidence_claim_id" uuid NOT NULL,
	"source_reference_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "evidence_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"knowledge_asset_id" uuid NOT NULL,
	"source_reference_id" uuid NOT NULL,
	"claim_type" "evidence_claim_type" NOT NULL,
	"claim_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"knowledge_asset_id" uuid NOT NULL,
	"evidence_claim_id" uuid NOT NULL,
	"source_reference_id" uuid NOT NULL,
	"role" text NOT NULL,
	"organization" text,
	"start_date" text,
	"end_date" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_document_id" uuid NOT NULL,
	"asset_type" "knowledge_asset_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"knowledge_asset_id" uuid NOT NULL,
	"evidence_claim_id" uuid NOT NULL,
	"source_reference_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"knowledge_asset_id" uuid NOT NULL,
	"evidence_claim_id" uuid NOT NULL,
	"source_reference_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_type" "source_document_type" NOT NULL,
	"path" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_content" text NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_references" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_document_id" uuid NOT NULL,
	"section" text NOT NULL,
	"locator" text NOT NULL,
	"excerpt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_knowledge_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("knowledge_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_evidence_claim_id_evidence_claims_id_fk" FOREIGN KEY ("evidence_claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_source_reference_id_source_references_id_fk" FOREIGN KEY ("source_reference_id") REFERENCES "public"."source_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_knowledge_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("knowledge_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_source_reference_id_source_references_id_fk" FOREIGN KEY ("source_reference_id") REFERENCES "public"."source_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_knowledge_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("knowledge_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_evidence_claim_id_evidence_claims_id_fk" FOREIGN KEY ("evidence_claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_source_reference_id_source_references_id_fk" FOREIGN KEY ("source_reference_id") REFERENCES "public"."source_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_knowledge_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("knowledge_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_evidence_claim_id_evidence_claims_id_fk" FOREIGN KEY ("evidence_claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_reference_id_source_references_id_fk" FOREIGN KEY ("source_reference_id") REFERENCES "public"."source_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_knowledge_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("knowledge_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_evidence_claim_id_evidence_claims_id_fk" FOREIGN KEY ("evidence_claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_source_reference_id_source_references_id_fk" FOREIGN KEY ("source_reference_id") REFERENCES "public"."source_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_references" ADD CONSTRAINT "source_references_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_documents_path_idx" ON "source_documents" ("path");--> statement-breakpoint
CREATE INDEX "knowledge_assets_source_document_id_idx" ON "knowledge_assets" ("source_document_id");--> statement-breakpoint
CREATE INDEX "source_references_source_document_id_idx" ON "source_references" ("source_document_id");--> statement-breakpoint
CREATE INDEX "evidence_claims_knowledge_asset_id_idx" ON "evidence_claims" ("knowledge_asset_id");
