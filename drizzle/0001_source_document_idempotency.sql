CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "source_documents" ADD COLUMN IF NOT EXISTS "content_hash" text;
--> statement-breakpoint
UPDATE "source_documents"
SET "content_hash" = encode(digest("raw_content", 'sha256'), 'hex')
WHERE "content_hash" IS NULL;
--> statement-breakpoint
CREATE TEMP TABLE duplicate_source_documents_to_delete ON COMMIT DROP AS
SELECT id
FROM (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY path, content_hash
      ORDER BY ingested_at ASC, id ASC
    ) AS duplicate_rank
  FROM "source_documents"
) ranked_source_documents
WHERE duplicate_rank > 1;
--> statement-breakpoint
DELETE FROM "achievements"
USING "knowledge_assets", duplicate_source_documents_to_delete
WHERE "achievements"."knowledge_asset_id" = "knowledge_assets"."id"
  AND "knowledge_assets"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "projects"
USING "knowledge_assets", duplicate_source_documents_to_delete
WHERE "projects"."knowledge_asset_id" = "knowledge_assets"."id"
  AND "knowledge_assets"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "experiences"
USING "knowledge_assets", duplicate_source_documents_to_delete
WHERE "experiences"."knowledge_asset_id" = "knowledge_assets"."id"
  AND "knowledge_assets"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "skills"
USING "knowledge_assets", duplicate_source_documents_to_delete
WHERE "skills"."knowledge_asset_id" = "knowledge_assets"."id"
  AND "knowledge_assets"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "evidence_claims"
USING "knowledge_assets", duplicate_source_documents_to_delete
WHERE "evidence_claims"."knowledge_asset_id" = "knowledge_assets"."id"
  AND "knowledge_assets"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "source_references"
USING duplicate_source_documents_to_delete
WHERE "source_references"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "knowledge_assets"
USING duplicate_source_documents_to_delete
WHERE "knowledge_assets"."source_document_id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
DELETE FROM "source_documents"
USING duplicate_source_documents_to_delete
WHERE "source_documents"."id" = duplicate_source_documents_to_delete.id;
--> statement-breakpoint
ALTER TABLE "source_documents" ALTER COLUMN "content_hash" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "source_documents_path_content_hash_unique"
ON "source_documents" ("path", "content_hash");
