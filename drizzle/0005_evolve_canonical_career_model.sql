ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'professional_profile';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'organization';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'professional_experience';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'role';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'project';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'initiative';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'product';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'education';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'certification';--> statement-breakpoint
ALTER TYPE "public"."knowledge_asset_type" ADD VALUE IF NOT EXISTS 'skill';--> statement-breakpoint
CREATE TYPE "public"."evidence_claim_category" AS ENUM('fact', 'responsibility', 'achievement', 'metric', 'capability', 'relationship');--> statement-breakpoint
CREATE TYPE "public"."evidence_claim_predicate" AS ENUM('works_at', 'holds_role', 'uses_technology', 'participated_in', 'occurred_during', 'reduced_processing_time', 'reduced_cost', 'improved_reliability', 'demonstrates');--> statement-breakpoint
ALTER TABLE "source_references" ADD COLUMN "source_language" text;--> statement-breakpoint
ALTER TABLE "source_references" ADD COLUMN "original_section_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "source_references" SET "original_section_label" = "section" WHERE "original_section_label" = '';--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "subject_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "claim_category" "evidence_claim_category" DEFAULT 'fact' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "predicate" "evidence_claim_predicate" DEFAULT 'demonstrates' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "related_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "value_text" text;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "value_unit" text;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "source_language" text;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "original_section_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "evidence_claims"
SET
	"subject_asset_id" = "knowledge_asset_id",
	"claim_category" = CASE
		WHEN "claim_type" = 'skill' THEN 'capability'::"public"."evidence_claim_category"
		WHEN "claim_type" = 'achievement' THEN 'achievement'::"public"."evidence_claim_category"
		ELSE 'fact'::"public"."evidence_claim_category"
	END,
	"predicate" = CASE
		WHEN "claim_type" = 'skill' THEN 'demonstrates'::"public"."evidence_claim_predicate"
		WHEN "claim_type" = 'experience' THEN 'holds_role'::"public"."evidence_claim_predicate"
		WHEN "claim_type" = 'project' THEN 'participated_in'::"public"."evidence_claim_predicate"
		ELSE 'demonstrates'::"public"."evidence_claim_predicate"
	END,
	"original_section_label" = COALESCE((
		SELECT "source_references"."section"
		FROM "source_references"
		WHERE "source_references"."id" = "evidence_claims"."source_reference_id"
	), '')
WHERE "subject_asset_id" IS NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ALTER COLUMN "subject_asset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_subject_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("subject_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_related_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("related_asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_claims_subject_asset_id_idx" ON "evidence_claims" USING btree ("subject_asset_id");--> statement-breakpoint
CREATE INDEX "evidence_claims_predicate_idx" ON "evidence_claims" USING btree ("predicate");--> statement-breakpoint
CREATE INDEX "evidence_claims_related_asset_id_idx" ON "evidence_claims" USING btree ("related_asset_id");
