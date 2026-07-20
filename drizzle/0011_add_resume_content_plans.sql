CREATE TABLE IF NOT EXISTS "resume_content_plans" (
  "id" uuid PRIMARY KEY NOT NULL,
  "plan_identity" text NOT NULL,
  "schema_version" text NOT NULL,
  "job_description_id" uuid NOT NULL REFERENCES "job_descriptions"("id") ON DELETE CASCADE,
  "curated_evidence_pack_id" uuid NOT NULL REFERENCES "curated_evidence_packs"("id") ON DELETE CASCADE,
  "language" text NOT NULL,
  "length" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_version" text NOT NULL,
  "resume_plan" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "resume_content_plans_language_check" CHECK ("language" IN ('pt-BR', 'en')),
  CONSTRAINT "resume_content_plans_length_check" CHECK ("length" IN ('concise', 'standard', 'detailed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_content_plans_job_description_created_at_idx"
  ON "resume_content_plans" ("job_description_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_content_plans_curated_evidence_pack_idx"
  ON "resume_content_plans" ("curated_evidence_pack_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resume_content_plans_plan_identity_unique"
  ON "resume_content_plans" ("plan_identity");
