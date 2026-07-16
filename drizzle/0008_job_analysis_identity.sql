ALTER TABLE "job_analyses" ADD COLUMN "analysis_identity" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "job_analyses_job_description_analysis_identity_unique" ON "job_analyses" USING btree ("job_description_id", "analysis_identity");
