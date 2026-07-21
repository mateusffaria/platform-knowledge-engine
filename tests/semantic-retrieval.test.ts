import { describe, expect, it } from "vitest";

import {
  IndexableEvidenceClaim,
  IndexableKnowledgeAsset,
  IndexableKnowledgeReader
} from "../src/modules/knowledge/application/ports/indexable-knowledge-reader.js";
import {
  buildEvidenceClaimEmbeddingDocument,
  buildKnowledgeAssetEmbeddingDocument
} from "../src/modules/retrieval/application/embedding-text.js";
import { isClaimIndexableStatus } from "../src/modules/reconciliation/domain/eligibility.js";
import { EmbeddingProvider } from "../src/modules/retrieval/application/ports/embedding-provider.js";
import { VectorStore, VectorUpsertInput, VectorSearchInput } from "../src/modules/retrieval/application/ports/vector-store.js";
import { createIndexKnowledgeUseCase } from "../src/modules/retrieval/application/use-cases/index-knowledge.js";
import { createSearchKnowledgeUseCase } from "../src/modules/retrieval/application/use-cases/search-knowledge.js";
import { EmbeddingVector, SearchResult } from "../src/modules/retrieval/application/types.js";

const asset: IndexableKnowledgeAsset = {
  id: "asset-1",
  sourceDocumentId: "source-1",
  assetType: "professional_profile",
  title: "Mateus Faria Professional Profile",
  summary: "Staff engineer focused on retrieval systems.",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  source: {
    id: "source-1",
    path: "examples/profiles/canonical-professional-profile-v1.md",
    contentHash: "abc123",
    sourceType: "markdown"
  }
};

const claim: IndexableEvidenceClaim = {
  id: "claim-1",
  knowledgeAssetId: "asset-1",
  subjectAssetId: "asset-1",
  sourceReferenceId: "reference-1",
  claimType: "project",
  claimCategory: "achievement",
  predicate: "participated_in",
  claimText: "Built a pgvector retrieval service.",
  valueText: "pgvector retrieval service",
  sourceLanguage: "en",
  originalSectionLabel: "Projects",
  status: "single_source",
  confidenceScore: 50,
  conflictSeverity: "none",
  asset: {
    id: "asset-1",
    title: "Mateus Faria Professional Profile",
    summary: "Staff engineer focused on retrieval systems.",
    assetType: "professional_profile",
    sourceDocumentId: "source-1"
  },
  source: {
    id: "source-1",
    path: "examples/profiles/canonical-professional-profile-v1.md",
    contentHash: "abc123",
    sourceType: "markdown"
  },
  reference: {
    id: "reference-1",
    sourceDocumentId: "source-1",
    section: "Projects",
    locator: "Projects item 1",
    excerpt: "Built a pgvector retrieval service.",
    sourceLanguage: "en",
    originalSectionLabel: "Projects"
  },
  verified: true
};

class FakeKnowledgeReader implements IndexableKnowledgeReader {
  constructor(
    private readonly assets: IndexableKnowledgeAsset[],
    private readonly claims: IndexableEvidenceClaim[]
  ) {}

  async listIndexableKnowledgeAssets(): Promise<IndexableKnowledgeAsset[]> {
    return this.assets;
  }

  async listIndexableEvidenceClaims(): Promise<IndexableEvidenceClaim[]> {
    return this.claims;
  }
}

class RecordingEmbeddingProvider implements EmbeddingProvider {
  public documentTexts: string[][] = [];
  public queryTexts: string[] = [];

  async embedDocuments(texts: string[]): Promise<EmbeddingVector[]> {
    this.documentTexts.push(texts);
    return texts.map((_, index) => ({
      provider: "test",
      model: "deterministic",
      dimensions: 3,
      values: [index + 1, 0, 0]
    }));
  }

  async embedQuery(text: string): Promise<EmbeddingVector> {
    this.queryTexts.push(text);
    return {
      provider: "test",
      model: "deterministic",
      dimensions: 3,
      values: [1, 0, 0]
    };
  }
}

class InMemoryVectorStore implements VectorStore {
  public upserts: VectorUpsertInput[][] = [];
  public upsertOptions: Array<{ force?: boolean } | undefined> = [];
  public searches: VectorSearchInput[] = [];
  private readonly rows = new Map<string, VectorUpsertInput>();

  constructor(private readonly searchResults?: SearchResult[]) {}

  async upsertEmbeddings(inputs: VectorUpsertInput[], options?: { force?: boolean }): Promise<{ inserted: number; updated: number; unchanged: number }> {
    this.upserts.push(inputs);
    this.upsertOptions.push(options);
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const input of inputs) {
      const key = `${input.document.subjectType}:${input.document.subjectId}:${input.embedding.provider}:${input.embedding.model}`;
      const existing = this.rows.get(key);
      if (!existing) {
        this.rows.set(key, input);
        inserted += 1;
        continue;
      }

      if (!options?.force && existing.document.textHash === input.document.textHash) {
        unchanged += 1;
        continue;
      }

      this.rows.set(key, input);
      updated += 1;
    }

    return { inserted, updated, unchanged };
  }

  async search(input: VectorSearchInput): Promise<SearchResult[]> {
    this.searches.push(input);
    return this.searchResults ?? [
      {
        subjectType: "evidence_claim",
        subjectId: "claim-1",
        knowledgeAssetId: "asset-1",
        evidenceClaimId: "claim-1",
        sourceDocumentId: "source-1",
        sourceReferenceId: "reference-1",
        similarityScore: 0.99,
        text: "claim_text: Built a pgvector retrieval service."
      }
    ];
  }

  async deleteEmbeddingsForSubject(input: { subjectType: "knowledge_asset" | "evidence_claim"; subjectId: string }): Promise<number> {
    const keyPrefix = `${input.subjectType}:${input.subjectId}:`;
    let deleted = 0;

    for (const key of Array.from(this.rows.keys())) {
      if (key.startsWith(keyPrefix)) {
        this.rows.delete(key);
        deleted += 1;
      }
    }

    return deleted;
  }
}

const reconciliationClaimEligibilityPolicy = {
  canIndexClaim(claim: IndexableEvidenceClaim): boolean {
    return isClaimIndexableStatus(claim.status);
  }
};

describe("Semantic retrieval", () => {
  it("builds deterministic embedding text with provenance for assets and evidence claims", () => {
    const firstAssetDocument = buildKnowledgeAssetEmbeddingDocument(asset);
    const secondAssetDocument = buildKnowledgeAssetEmbeddingDocument({ ...asset });
    const claimDocument = buildEvidenceClaimEmbeddingDocument(claim);

    expect(secondAssetDocument).toEqual(firstAssetDocument);
    expect(firstAssetDocument.text).toContain("knowledge_asset_id: asset-1");
    expect(firstAssetDocument.text).toContain("source_document_id: source-1");
    expect(firstAssetDocument.text).toContain("title: Mateus Faria Professional Profile");

    expect(claimDocument.text).toContain("evidence_claim_id: claim-1");
    expect(claimDocument.text).toContain("knowledge_asset_id: asset-1");
    expect(claimDocument.text).toContain("subject_asset_id: asset-1");
    expect(claimDocument.text).toContain("source_reference_id: reference-1");
    expect(claimDocument.text).toContain("claim_type: project");
    expect(claimDocument.text).toContain("claim_category: achievement");
    expect(claimDocument.text).toContain("predicate: participated_in");
    expect(claimDocument.text).toContain("claim_status: single_source");
    expect(claimDocument.text).toContain("source_language: en");
    expect(claimDocument.text).toContain("original_section_label: Projects");
    expect(claimDocument.text).toContain("value_text: pgvector retrieval service");
    expect(claimDocument.text).toContain("claim_text: Built a pgvector retrieval service.");
    expect(claimDocument.textHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("indexes unchanged knowledge idempotently with mocked embeddings", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore();
    const useCase = createIndexKnowledgeUseCase({
      knowledgeReader: new FakeKnowledgeReader([asset], [claim]),
      embeddingProvider,
      vectorStore,
      claimEligibilityPolicy: reconciliationClaimEligibilityPolicy
    });

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first).toEqual({ indexed: 2, skipped: 0 });
    expect(second).toEqual({ indexed: 0, skipped: 2 });
    expect(vectorStore.upserts).toHaveLength(2);
    expect(vectorStore.upserts[0]).toHaveLength(2);
  });

  it("forces unchanged candidate embeddings to be updated", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore();
    const useCase = createIndexKnowledgeUseCase({
      knowledgeReader: new FakeKnowledgeReader([asset], [claim]),
      embeddingProvider,
      vectorStore,
      claimEligibilityPolicy: reconciliationClaimEligibilityPolicy
    });

    await useCase.execute();
    const forced = await useCase.execute({ force: true });

    expect(forced).toEqual({ indexed: 2, skipped: 0 });
    expect(vectorStore.upsertOptions.at(-1)).toEqual({ force: true });
  });

  it("searches through embedding and vector store ports and returns evidence identifiers", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore();
    const useCase = createSearchKnowledgeUseCase({ embeddingProvider, vectorStore });

    const result = await useCase.execute({ query: "pgvector retrieval", limit: 5 });

    expect(embeddingProvider.queryTexts).toEqual(["pgvector retrieval"]);
    expect(vectorStore.searches).toHaveLength(1);
    expect(vectorStore.searches[0].limit).toBe(5);
    expect(result.status).toBe("results");
    expect(result.results[0]).toMatchObject({
      subjectType: "evidence_claim",
      evidenceClaimId: "claim-1",
      sourceReferenceId: "reference-1",
      similarityScore: 0.99
    });
  });

  it("returns relevant query results above the configured threshold", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore([
      {
        subjectType: "evidence_claim",
        subjectId: "claim-1",
        knowledgeAssetId: "asset-1",
        evidenceClaimId: "claim-1",
        sourceDocumentId: "source-1",
        sourceReferenceId: "reference-1",
        similarityScore: 0.82,
        text: "claim_text: Built a pgvector retrieval service."
      },
      {
        subjectType: "evidence_claim",
        subjectId: "claim-2",
        knowledgeAssetId: "asset-1",
        evidenceClaimId: "claim-2",
        sourceDocumentId: "source-1",
        similarityScore: 0.41,
        text: "claim_text: Unrelated detail."
      }
    ]);
    const useCase = createSearchKnowledgeUseCase({
      embeddingProvider,
      vectorStore,
      defaultMinScore: 0.7
    });

    const result = await useCase.execute({ query: "pgvector retrieval" });

    expect(result).toMatchObject({
      status: "results",
      minScore: 0.7,
      results: [
        {
          subjectId: "claim-1",
          similarityScore: 0.82
        }
      ]
    });
  });

  it("returns no relevant evidence when all matches are below threshold", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore([
      {
        subjectType: "evidence_claim",
        subjectId: "claim-1",
        knowledgeAssetId: "asset-1",
        evidenceClaimId: "claim-1",
        sourceDocumentId: "source-1",
        similarityScore: 0.31,
        text: "claim_text: Unrelated detail."
      }
    ]);
    const useCase = createSearchKnowledgeUseCase({
      embeddingProvider,
      vectorStore,
      defaultMinScore: 0.7
    });

    const result = await useCase.execute({ query: "unrelated query" });

    expect(result).toEqual({
      status: "no_relevant_evidence",
      query: "unrelated query",
      limit: 10,
      minScore: 0.7,
      bestSimilarityScore: 0.31,
      results: []
    });
  });

  it("uses explicit minScore over the configured threshold", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore([
      {
        subjectType: "evidence_claim",
        subjectId: "claim-1",
        knowledgeAssetId: "asset-1",
        evidenceClaimId: "claim-1",
        sourceDocumentId: "source-1",
        similarityScore: 0.6,
        text: "claim_text: Relevant enough for override."
      }
    ]);
    const useCase = createSearchKnowledgeUseCase({
      embeddingProvider,
      vectorStore,
      defaultMinScore: 0.9
    });

    const result = await useCase.execute({ query: "override", minScore: 0.5 });

    expect(result.status).toBe("results");
    expect(result.minScore).toBe(0.5);
    expect(result.results).toHaveLength(1);
  });

  it("preserves vector-store ordering by descending similarity", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore([
      {
        subjectType: "evidence_claim",
        subjectId: "high",
        knowledgeAssetId: "asset-1",
        sourceDocumentId: "source-1",
        similarityScore: 0.91,
        text: "claim_text: High score."
      },
      {
        subjectType: "evidence_claim",
        subjectId: "middle",
        knowledgeAssetId: "asset-1",
        sourceDocumentId: "source-1",
        similarityScore: 0.72,
        text: "claim_text: Middle score."
      }
    ]);
    const useCase = createSearchKnowledgeUseCase({ embeddingProvider, vectorStore });

    const result = await useCase.execute({ query: "ordered" });

    expect(result.status).toBe("results");
    expect(result.results.map((searchResult) => searchResult.subjectId)).toEqual(["high", "middle"]);
  });

  it("excludes rejected and superseded claims from indexing", async () => {
    const embeddingProvider = new RecordingEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore();
    const useCase = createIndexKnowledgeUseCase({
      knowledgeReader: new FakeKnowledgeReader([], [
        { ...claim, id: "rejected-claim", status: "rejected", verified: false },
        { ...claim, id: "superseded-claim", status: "superseded", verified: false }
      ]),
      embeddingProvider,
      vectorStore,
      claimEligibilityPolicy: reconciliationClaimEligibilityPolicy
    });

    const result = await useCase.execute();

    expect(result).toEqual({ indexed: 0, skipped: 0 });
    expect(embeddingProvider.documentTexts).toEqual([]);
    expect(vectorStore.upserts).toEqual([]);
  });
});
