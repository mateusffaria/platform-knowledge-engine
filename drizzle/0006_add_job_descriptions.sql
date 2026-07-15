CREATE TYPE "public"."job_source_type" AS ENUM('markdown', 'plain_text');--> statement-breakpoint
CREATE TYPE "public"."job_requirement_type" AS ENUM('skill', 'technology', 'experience', 'responsibility', 'seniority', 'domain', 'education', 'language');--> statement-breakpoint
CREATE TYPE "public"."job_requirement_importance" AS ENUM('required', 'preferred');--> statement-breakpoint
CREATE TABLE "job_descriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_type" "job_source_type" NOT NULL,
	"source_path" text NOT NULL,
	"raw_content" text NOT NULL,
	"content_hash" text NOT NULL,
	"title" text,
	"ingested_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_requirements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_description_id" uuid NOT NULL,
	"requirement_type" "job_requirement_type" NOT NULL,
	"importance" "job_requirement_importance" NOT NULL,
	"normalized_value" text,
	"original_text" text NOT NULL,
	"source_excerpt" text NOT NULL,
	"source_start_line" integer NOT NULL,
	"source_end_line" integer NOT NULL,
	"section_label" text,
	"inferred" boolean DEFAULT false NOT NULL,
	CONSTRAINT "job_requirements_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "job_descriptions_source_path_idx" ON "job_descriptions" USING btree ("source_path");--> statement-breakpoint
CREATE UNIQUE INDEX "job_descriptions_source_path_content_hash_unique" ON "job_descriptions" USING btree ("source_path", "content_hash");--> statement-breakpoint
CREATE INDEX "job_requirements_job_description_id_idx" ON "job_requirements" USING btree ("job_description_id");--> statement-breakpoint
CREATE INDEX "job_requirements_type_normalized_value_idx" ON "job_requirements" USING btree ("requirement_type", "normalized_value");--> statement-breakpoint
CREATE INDEX "job_requirements_importance_idx" ON "job_requirements" USING btree ("importance");
