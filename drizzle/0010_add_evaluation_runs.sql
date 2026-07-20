CREATE TABLE "evaluation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"dataset_version" text NOT NULL,
	"dataset_hash" text NOT NULL,
	"requested_scenario_id" text,
	"git_sha" text NOT NULL,
	"provider" text,
	"model" text,
	"prompt_version" text,
	"candidate_pack_versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"report_schema_version" text NOT NULL,
	"quality_metrics" jsonb NOT NULL,
	"performance_metrics" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"assertions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"observation" jsonb,
	"diagnostic" jsonb,
	CONSTRAINT "evaluation_results_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "evaluation_runs_dataset_version_idx" ON "evaluation_runs" USING btree ("dataset_id", "dataset_version");
--> statement-breakpoint
CREATE INDEX "evaluation_runs_completed_at_idx" ON "evaluation_runs" USING btree ("completed_at");
--> statement-breakpoint
CREATE INDEX "evaluation_results_run_id_idx" ON "evaluation_results" USING btree ("run_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "evaluation_results_run_scenario_stage_unique" ON "evaluation_results" USING btree ("run_id", "scenario_id", "stage");
