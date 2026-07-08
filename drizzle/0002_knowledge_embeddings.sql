CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."embedding_subject_type" AS ENUM('knowledge_asset', 'evidence_claim');
--> statement-breakpoint
CREATE TABLE "knowledge_embeddings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_type" "embedding_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"knowledge_asset_id" uuid NOT NULL,
	"evidence_claim_id" uuid,
	"source_document_id" uuid NOT NULL,
	"source_reference_id" uuid,
	"embedding_text" text NOT NULL,
	"embedding_text_hash" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_knowledge_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("knowledge_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_evidence_claim_id_evidence_claims_id_fk" FOREIGN KEY ("evidence_claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_source_reference_id_source_references_id_fk" FOREIGN KEY ("source_reference_id") REFERENCES "public"."source_references"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_subject_idx" ON "knowledge_embeddings" ("subject_type", "subject_id");
--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_knowledge_asset_id_idx" ON "knowledge_embeddings" ("knowledge_asset_id");
--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_evidence_claim_id_idx" ON "knowledge_embeddings" ("evidence_claim_id");
--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_source_reference_id_idx" ON "knowledge_embeddings" ("source_reference_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_embeddings_identity_unique" ON "knowledge_embeddings" ("subject_type", "subject_id", "provider", "model");
