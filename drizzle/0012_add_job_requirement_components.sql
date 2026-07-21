CREATE TABLE "job_requirement_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_requirement_id" uuid NOT NULL,
	"component_index" integer NOT NULL,
	"original_text" text NOT NULL,
	"requirement_type" "job_requirement_type" NOT NULL,
	"importance" "job_requirement_importance" NOT NULL,
	"normalized_value" text,
	"source_excerpt" text NOT NULL,
	"source_start_line" integer NOT NULL,
	"source_end_line" integer NOT NULL,
	"source_text_start" integer NOT NULL,
	"source_text_end" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_requirement_components" ADD CONSTRAINT "job_requirement_components_job_requirement_id_job_requirements_id_fk" FOREIGN KEY ("job_requirement_id") REFERENCES "public"."job_requirements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "job_requirement_components_requirement_id_idx" ON "job_requirement_components" USING btree ("job_requirement_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "job_requirement_components_requirement_order_unique" ON "job_requirement_components" USING btree ("job_requirement_id", "component_index");
--> statement-breakpoint
CREATE INDEX "job_requirement_components_type_normalized_value_idx" ON "job_requirement_components" USING btree ("requirement_type", "normalized_value");
