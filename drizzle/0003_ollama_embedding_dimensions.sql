DELETE FROM "knowledge_embeddings" WHERE "dimensions" <> 768;
--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ALTER COLUMN "embedding" TYPE vector(768);
