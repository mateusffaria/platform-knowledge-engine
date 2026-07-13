CREATE TYPE "public"."claim_status_transition_source" AS ENUM('system', 'user');--> statement-breakpoint
CREATE TYPE "public"."conflict_severity" AS ENUM('none', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."evidence_claim_status" AS ENUM('confirmed', 'single_source', 'needs_review', 'rejected', 'superseded');--> statement-breakpoint
ALTER TABLE "source_documents" ADD COLUMN "source_reliability" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "status" "evidence_claim_status" DEFAULT 'single_source' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "confidence_score" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "conflict_severity" "conflict_severity" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD COLUMN "review_reason" text;--> statement-breakpoint
CREATE TABLE "claim_status_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evidence_claim_id" uuid NOT NULL,
	"previous_status" "evidence_claim_status",
	"next_status" "evidence_claim_status" NOT NULL,
	"reason" text,
	"transition_source" "claim_status_transition_source" NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_status_events" ADD CONSTRAINT "claim_status_events_evidence_claim_id_evidence_claims_id_fk" FOREIGN KEY ("evidence_claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_status_events_evidence_claim_id_idx" ON "claim_status_events" USING btree ("evidence_claim_id");
