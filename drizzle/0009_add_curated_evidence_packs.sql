CREATE TABLE "curated_evidence_packs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_description_id" uuid NOT NULL,
	"job_analysis_id" uuid,
	"candidate_pack_version" text NOT NULL,
	"candidate_pack_hash" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"run_identity" text NOT NULL,
	"curated_evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "curated_evidence_packs_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "curated_evidence_packs_job_analysis_id_job_analyses_id_fk" FOREIGN KEY ("job_analysis_id") REFERENCES "public"."job_analyses"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "curated_evidence_packs_job_description_created_at_idx" ON "curated_evidence_packs" USING btree ("job_description_id", "created_at");
--> statement-breakpoint
CREATE INDEX "curated_evidence_packs_candidate_pack_hash_idx" ON "curated_evidence_packs" USING btree ("candidate_pack_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "curated_evidence_packs_job_description_run_identity_unique" ON "curated_evidence_packs" USING btree ("job_description_id", "run_identity");
