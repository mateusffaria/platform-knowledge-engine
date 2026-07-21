CREATE TABLE IF NOT EXISTS "generated_resume_artifacts" (
  "id" uuid PRIMARY KEY,
  "rendering_identity" text NOT NULL,
  "generation_identity" text NOT NULL,
  "job_description_id" uuid NOT NULL REFERENCES "job_descriptions"("id") ON DELETE CASCADE,
  "job_analysis_id" uuid REFERENCES "job_analyses"("id") ON DELETE SET NULL,
  "curated_evidence_pack_id" uuid NOT NULL REFERENCES "curated_evidence_packs"("id") ON DELETE CASCADE,
  "resume_content_plan_id" uuid NOT NULL REFERENCES "resume_content_plans"("id") ON DELETE CASCADE,
  "format" text NOT NULL,
  "language" text NOT NULL,
  "length" text NOT NULL,
  "template_id" text NOT NULL,
  "template_version" text NOT NULL,
  "renderer_version" text NOT NULL,
  "artifact_path" text NOT NULL,
  "manifest_path" text NOT NULL,
  "media_type" text NOT NULL,
  "checksum" text NOT NULL,
  "byte_count" integer NOT NULL CHECK ("byte_count" > 0),
  "page_count" integer CHECK ("page_count" IS NULL OR "page_count" > 0),
  "manifest" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  CONSTRAINT "generated_resume_artifacts_format_check" CHECK ("format" IN ('markdown', 'html', 'pdf')),
  CONSTRAINT "generated_resume_artifacts_language_check" CHECK ("language" IN ('pt-BR', 'en')),
  CONSTRAINT "generated_resume_artifacts_length_check" CHECK ("length" IN ('concise', 'standard', 'detailed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_resume_artifacts_rendering_identity_idx"
  ON "generated_resume_artifacts" ("rendering_identity", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_resume_artifacts_job_description_idx"
  ON "generated_resume_artifacts" ("job_description_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_resume_artifacts_resume_content_plan_idx"
  ON "generated_resume_artifacts" ("resume_content_plan_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "generated_resume_artifacts_generation_identity_unique"
  ON "generated_resume_artifacts" ("generation_identity");
