import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { embeddingDimensions, knowledgeEmbeddings } from "../../../../shared/database/schema.js";
import { VectorStore, VectorUpsertInput, VectorSearchInput } from "../../application/ports/vector-store.js";
import { SearchResult } from "../../application/types.js";

interface VectorDatabase {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
  execute: (...args: any[]) => any;
}

function ensureSupportedDimensions(values: number[], dimensions: number): void {
  if (dimensions !== embeddingDimensions || values.length !== embeddingDimensions) {
    throw new Error(`Expected ${embeddingDimensions}-dimension embeddings but received ${dimensions}.`);
  }

  if (!values.every(Number.isFinite)) {
    throw new Error("Embedding vectors must contain only finite numbers.");
  }
}

function candidateConstraint(input: VectorSearchInput) {
  const conditions = [];
  if (input.candidateEvidenceClaimIds && input.candidateEvidenceClaimIds.length > 0) {
    conditions.push(sql`evidence_claim_id IN (${sql.join(
      input.candidateEvidenceClaimIds.map((id) => sql`${id}`),
      sql`, `
    )})`);
  }
  if (input.candidateKnowledgeAssetIds && input.candidateKnowledgeAssetIds.length > 0) {
    conditions.push(sql`knowledge_asset_id IN (${sql.join(
      input.candidateKnowledgeAssetIds.map((id) => sql`${id}`),
      sql`, `
    )})`);
  }

  return conditions.length > 0 ? sql`AND (${sql.join(conditions, sql` OR `)})` : sql``;
}

export class PgvectorStore implements VectorStore {
  constructor(private readonly db: VectorDatabase) {}

  async upsertEmbeddings(inputs: VectorUpsertInput[], options: { force?: boolean } = {}): Promise<{ inserted: number; updated: number; unchanged: number }> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const input of inputs) {
      ensureSupportedDimensions(input.embedding.values, input.embedding.dimensions);

      const existing = await this.db
        .select({
          id: knowledgeEmbeddings.id,
          embeddingTextHash: knowledgeEmbeddings.embeddingTextHash
        })
        .from(knowledgeEmbeddings)
        .where(
          and(
            eq(knowledgeEmbeddings.subjectType, input.document.subjectType),
            eq(knowledgeEmbeddings.subjectId, input.document.subjectId),
            eq(knowledgeEmbeddings.provider, input.embedding.provider),
            eq(knowledgeEmbeddings.model, input.embedding.model)
          )
        )
        .limit(1);

      const now = new Date();
      const values = {
        subjectType: input.document.subjectType,
        subjectId: input.document.subjectId,
        knowledgeAssetId: input.document.knowledgeAssetId,
        evidenceClaimId: input.document.evidenceClaimId,
        sourceDocumentId: input.document.sourceDocumentId,
        sourceReferenceId: input.document.sourceReferenceId,
        embeddingText: input.document.text,
        embeddingTextHash: input.document.textHash,
        provider: input.embedding.provider,
        model: input.embedding.model,
        dimensions: input.embedding.dimensions,
        embedding: input.embedding.values,
        updatedAt: now
      };

      if (existing.length === 0) {
        await this.db.insert(knowledgeEmbeddings).values({
          id: randomUUID(),
          ...values,
          createdAt: now
        });
        inserted += 1;
        continue;
      }

      if (!options.force && existing[0].embeddingTextHash === input.document.textHash) {
        unchanged += 1;
        continue;
      }

      await this.db
        .update(knowledgeEmbeddings)
        .set(values)
        .where(eq(knowledgeEmbeddings.id, existing[0].id));
      updated += 1;
    }

    return { inserted, updated, unchanged };
  }

  async search(input: VectorSearchInput): Promise<SearchResult[]> {
    ensureSupportedDimensions(input.embedding.values, input.embedding.dimensions);
    const vectorLiteral = `[${input.embedding.values.join(",")}]`;
    const rows = await this.db.execute(sql`
      SELECT
        subject_type AS "subjectType",
        subject_id AS "subjectId",
        knowledge_asset_id AS "knowledgeAssetId",
        evidence_claim_id AS "evidenceClaimId",
        source_document_id AS "sourceDocumentId",
        source_reference_id AS "sourceReferenceId",
        1 - (embedding <=> ${vectorLiteral}::vector) AS "similarityScore",
        embedding_text AS text
      FROM knowledge_embeddings
      WHERE provider = ${input.embedding.provider}
        AND model = ${input.embedding.model}
        ${candidateConstraint(input)}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${input.limit}
    `);

    return rows.map((row: any) => ({
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      knowledgeAssetId: row.knowledgeAssetId,
      evidenceClaimId: row.evidenceClaimId ?? undefined,
      sourceDocumentId: row.sourceDocumentId,
      sourceReferenceId: row.sourceReferenceId ?? undefined,
      similarityScore: Number(row.similarityScore),
      text: row.text
    }));
  }

  async deleteEmbeddingsForSubject(input: { subjectType: "knowledge_asset" | "evidence_claim"; subjectId: string }): Promise<number> {
    const deleted = await this.db
      .delete(knowledgeEmbeddings)
      .where(and(
        eq(knowledgeEmbeddings.subjectType, input.subjectType),
        eq(knowledgeEmbeddings.subjectId, input.subjectId)
      ))
      .returning({ id: knowledgeEmbeddings.id });

    return deleted.length;
  }
}
