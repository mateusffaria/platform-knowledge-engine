CREATE TABLE "job_analyses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_description_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"analysis" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "job_analyses_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "job_analyses_job_description_created_at_idx" ON "job_analyses" USING btree ("job_description_id", "created_at");
