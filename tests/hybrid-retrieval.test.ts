import { describe, expect, it } from "vitest";

import { EmbeddingProvider } from "../src/modules/retrieval/application/ports/embedding-provider.js";
import { KnowledgeMetadataProvider } from "../src/modules/retrieval/application/ports/knowledge-metadata-provider.js";
import { StructuredKnowledgeSearch, StructuredKnowledgeSearchInput } from "../src/modules/retrieval/application/ports/structured-knowledge-search.js";
import { VectorStore, VectorSearchInput, VectorUpsertInput } from "../src/modules/retrieval/application/ports/vector-store.js";
import { createHybridSearchUseCase } from "../src/modules/retrieval/application/use-cases/hybrid-search.js";
import {
  EmbeddingVector,
  HybridSearchCandidate,
  SearchResult
} from "../src/modules/retrieval/application/types.js";

class FakeEmbeddingProvider implements EmbeddingProvider {
  public queries: string[] = [];

  async embedDocuments(texts: string[]): Promise<EmbeddingVector[]> {
    return texts.map(() => ({
      provider: "test",
      model: "hybrid",
      dimensions: 3,
      values: [1, 0, 0]
    }));
  }

  async embedQuery(text: string): Promise<EmbeddingVector> {
    this.queries.push(text);
    return {
      provider: "test",
      model: "hybrid",
      dimensions: 3,
      values: [1, 0, 0]
    };
  }
}

class FakeVectorStore implements VectorStore {
  public searches: VectorSearchInput[] = [];

  constructor(private readonly results: SearchResult[] = []) {}

  async upsertEmbeddings(_inputs: VectorUpsertInput[]): Promise<{ inserted: number; updated: number; unchanged: number }> {
    return { inserted: 0, updated: 0, unchanged: 0 };
  }

  async search(input: VectorSearchInput): Promise<SearchResult[]> {
    this.searches.push(input);
    if (!input.candidateEvidenceClaimIds && !input.candidateKnowledgeAssetIds) {
      return this.results;
    }

    return this.results.filter((result) => (
      (result.evidenceClaimId !== undefined && input.candidateEvidenceClaimIds?.includes(result.evidenceClaimId))
      || input.candidateKnowledgeAssetIds?.includes(result.knowledgeAssetId)
    ));
  }

  async deleteEmbeddingsForSubject(): Promise<number> {
    return 0;
  }
}

class FakeStructuredKnowledgeSearch implements StructuredKnowledgeSearch {
  public inputs: StructuredKnowledgeSearchInput[] = [];

  constructor(private readonly results: HybridSearchCandidate[] = []) {}

  async search(input: StructuredKnowledgeSearchInput): Promise<HybridSearchCandidate[]> {
    this.inputs.push(input);
    return this.results;
  }
}

const metadataProvider: KnowledgeMetadataProvider = {
  async getMetadata() {
    return {
      skills: ["TypeScript"],
      technologies: [],
      organizations: [],
      projects: [],
      roles: [],
      products: [],
      initiatives: []
    };
  }
};

function structuredCandidate(overrides: Partial<HybridSearchCandidate> = {}): HybridSearchCandidate {
  return {
    evidenceClaimId: "claim-1",
    knowledgeAssetId: "asset-1",
    subjectAssetId: "asset-1",
    subjectType: "skill",
    claimType: "skill",
    claimCategory: "capability",
    predicate: "demonstrates",
    claimText: "TypeScript",
    relatedAssetId: "skill-typescript",
    claimStatus: "single_source",
    confidenceScore: 70,
    structuredScore: 1,
    sources: [{
      id: "reference-1",
      sourceDocumentId: "source-1",
      section: "Skills",
      locator: "line:1",
      excerpt: "TypeScript",
      sourcePath: "examples/profile.md",
      sourceLanguage: "en",
      originalSectionLabel: "Skills"
    }],
    retrievalStrategies: ["structured"],
    ...overrides
  };
}

function semanticResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    subjectType: "evidence_claim",
    subjectId: "claim-1",
    knowledgeAssetId: "asset-1",
    evidenceClaimId: "claim-1",
    sourceDocumentId: "source-1",
    sourceReferenceId: "reference-1",
    similarityScore: 0.84,
    text: [
      "subject_type: evidence_claim",
      "evidence_claim_id: claim-1",
      "knowledge_asset_id: asset-1",
      "subject_asset_id: asset-1",
      "related_asset_id: skill-typescript",
      "source_document_id: source-1",
      "source_reference_id: reference-1",
      "source_path: examples/profile.md",
      "source_section: Skills",
      "source_locator: line:1",
      "source_language: en",
      "original_section_label: Skills",
      "claim_type: skill",
      "claim_category: capability",
      "predicate: demonstrates",
      "claim_status: single_source",
      "confidence_score: 70",
      "claim_text: TypeScript",
      "source_excerpt: TypeScript"
    ].join("\n"),
    ...overrides
  };
}

function createUseCase(input: {
  structured?: HybridSearchCandidate[];
  semantic?: SearchResult[];
  now?: Date;
}) {
  const embeddingProvider = new FakeEmbeddingProvider();
  const vectorStore = new FakeVectorStore(input.semantic);
  const structuredKnowledgeSearch = new FakeStructuredKnowledgeSearch(input.structured);
  const useCase = createHybridSearchUseCase({
    embeddingProvider,
    vectorStore,
    structuredKnowledgeSearch,
    knowledgeMetadataProvider: metadataProvider,
    now: () => input.now ?? new Date("2026-07-14T12:00:00.000Z")
  });

  return { embeddingProvider, vectorStore, structuredKnowledgeSearch, useCase };
}

describe("Hybrid retrieval", () => {
  it("returns structured-only matches with provenance and structured score", async () => {
    const { useCase, vectorStore } = createUseCase({
      structured: [structuredCandidate()]
    });

    const pack = await useCase.execute({ query: "TypeScript", limit: 5 });

    expect(vectorStore.searches).toHaveLength(0);
    expect(pack.strategies).toEqual(["structured"]);
    expect(pack.items).toHaveLength(1);
    expect(pack.items[0]).toMatchObject({
      evidenceClaimId: "claim-1",
      structuredScore: 1,
      semanticScore: undefined,
      sources: [expect.objectContaining({ id: "reference-1", excerpt: "TypeScript" })]
    });
  });

  it("passes filter-only PKQL filters to structured retrieval without embedding", async () => {
    const { embeddingProvider, structuredKnowledgeSearch, useCase } = createUseCase({
      structured: [structuredCandidate({ claimStatus: "confirmed" })]
    });

    const pack = await useCase.execute({ query: "status:confirmed", limit: 5 });

    expect(pack.strategies).toEqual(["structured"]);
    expect(embeddingProvider.queries).toEqual([]);
    expect(structuredKnowledgeSearch.inputs).toEqual([expect.objectContaining({
      filters: [expect.objectContaining({
        field: "status",
        value: expect.objectContaining({ value: "confirmed" })
      })],
      terms: []
    })]);
  });

  it("returns semantic-only matches with semantic score metadata", async () => {
    const { useCase, structuredKnowledgeSearch } = createUseCase({
      semantic: [semanticResult()]
    });

    const pack = await useCase.execute({ query: "leadership impact" });

    expect(structuredKnowledgeSearch.inputs).toHaveLength(0);
    expect(pack.strategies).toEqual(["semantic"]);
    expect(pack.items[0]).toMatchObject({
      evidenceClaimId: "claim-1",
      semanticScore: 0.84,
      claimStatus: "single_source"
    });
    expect(pack.items[0]).toMatchObject({
      subjectAssetId: "asset-1",
      claimCategory: "capability",
      predicate: "demonstrates",
      relatedAssetId: "skill-typescript",
      sources: [expect.objectContaining({ sourceLanguage: "en", originalSectionLabel: "Skills" })]
    });
  });

  it("uses structured retrieval only for a quoted company query", async () => {
    const { embeddingProvider, structuredKnowledgeSearch, useCase } = createUseCase({
      structured: [structuredCandidate({ claimStatus: "confirmed" })]
    });

    const pack = await useCase.execute({ query: 'company:"Acme Knowledge Systems"', limit: 5 });

    expect(pack.strategies).toEqual(["structured"]);
    expect(embeddingProvider.queries).toEqual([]);
    expect(structuredKnowledgeSearch.inputs[0].filters).toEqual([expect.objectContaining({
      field: "company",
      value: expect.objectContaining({ value: "Acme Knowledge Systems" })
    })]);
  });

  it("merges duplicate structured and semantic evidence into one item", async () => {
    const { useCase } = createUseCase({
      structured: [structuredCandidate({ structuredScore: 1 })],
      semantic: [semanticResult({ similarityScore: 0.88 })]
    });

    const pack = await useCase.execute({ query: "evidence of TypeScript impact" });

    expect(pack.strategies).toEqual(["structured", "semantic"]);
    expect(pack.items).toHaveLength(1);
    expect(pack.items[0]).toMatchObject({
      evidenceClaimId: "claim-1",
      structuredScore: 1,
      semanticScore: 0.88,
      retrievalStrategies: ["structured", "semantic"]
    });
  });

  it("passes mixed PKQL filters to structured retrieval and embeds only semantic text", async () => {
    const { embeddingProvider, structuredKnowledgeSearch, useCase } = createUseCase({
      structured: [structuredCandidate()],
      semantic: [semanticResult()]
    });

    const pack = await useCase.execute({ query: "company:Acme observability impact" });

    expect(pack.strategies).toEqual(["structured", "semantic"]);
    expect(structuredKnowledgeSearch.inputs[0]).toMatchObject({
      filters: [expect.objectContaining({
        field: "company",
        value: expect.objectContaining({ value: "Acme" })
      })]
    });
    expect(embeddingProvider.queries).toEqual(["observability impact"]);
  });

  it("constrains mixed semantic ranking to structured company candidates", async () => {
    const acmeCandidate = structuredCandidate({
      evidenceClaimId: "claim-acme",
      knowledgeAssetId: "asset-acme"
    });
    const unrelatedResult = semanticResult({
      evidenceClaimId: "claim-other",
      knowledgeAssetId: "asset-other",
      similarityScore: 0.99
    });
    const acmeResult = semanticResult({
      evidenceClaimId: "claim-acme",
      knowledgeAssetId: "asset-acme",
      similarityScore: 0.61
    });
    const { vectorStore, useCase } = createUseCase({
      structured: [acmeCandidate],
      semantic: [unrelatedResult, acmeResult]
    });

    const pack = await useCase.execute({ query: 'company:"Acme Knowledge Systems" observability' });

    expect(vectorStore.searches[0]).toMatchObject({
      candidateEvidenceClaimIds: ["claim-acme"],
      candidateKnowledgeAssetIds: ["asset-acme"]
    });
    expect(pack.items.map((item) => item.evidenceClaimId)).toEqual(["claim-acme"]);
  });

  it("falls back to the semantic corpus when explicit structured filters return no candidates", async () => {
    const { vectorStore, useCase } = createUseCase({
      structured: [],
      semantic: [semanticResult({ evidenceClaimId: "claim-go", knowledgeAssetId: "asset-go" })]
    });

    const pack = await useCase.execute({ query: 'technology:"Go" production backend services' });

    expect(vectorStore.searches[0].candidateEvidenceClaimIds).toBeUndefined();
    expect(vectorStore.searches[0].candidateKnowledgeAssetIds).toBeUndefined();
    expect(pack.items.map((item) => item.evidenceClaimId)).toEqual(["claim-go"]);
    expect(pack.diagnostics).toMatchObject({
      rawStructuredResultCount: 0,
      rawSemanticResultCount: 1
    });
  });

  it("supports partial company filters while keeping semantic ranking constrained", async () => {
    const acmeCandidate = structuredCandidate({
      evidenceClaimId: "claim-acme",
      knowledgeAssetId: "asset-acme"
    });
    const unrelatedResult = semanticResult({
      evidenceClaimId: "claim-other",
      knowledgeAssetId: "asset-other",
      similarityScore: 0.99
    });
    const acmeResult = semanticResult({
      evidenceClaimId: "claim-acme",
      knowledgeAssetId: "asset-acme",
      similarityScore: 0.61
    });
    const { vectorStore, useCase } = createUseCase({
      structured: [acmeCandidate],
      semantic: [unrelatedResult, acmeResult]
    });

    const pack = await useCase.execute({ query: "company:acme observability" });

    expect(vectorStore.searches[0].candidateEvidenceClaimIds).toEqual(["claim-acme"]);
    expect(pack.items.map((item) => item.evidenceClaimId)).toEqual(["claim-acme"]);
    expect(pack.warnings).toEqual([expect.stringContaining("Quote compound values")]);
  });

  it("keeps pure semantic queries unconstrained", async () => {
    const { vectorStore, useCase } = createUseCase({ semantic: [semanticResult()] });

    await useCase.execute({ query: "observability impact" });

    expect(vectorStore.searches[0].candidateEvidenceClaimIds).toBeUndefined();
    expect(vectorStore.searches[0].candidateKnowledgeAssetIds).toBeUndefined();
  });

  it("excludes rejected, superseded, and needs-review claims from evidence packs", async () => {
    const { useCase } = createUseCase({
      structured: [
        structuredCandidate({ evidenceClaimId: "claim-rejected", claimStatus: "rejected" }),
        structuredCandidate({ evidenceClaimId: "claim-superseded", claimStatus: "superseded" }),
        structuredCandidate({ evidenceClaimId: "claim-review", claimStatus: "needs_review" })
      ]
    });

    const pack = await useCase.execute({ query: "TypeScript" });

    expect(pack.items).toEqual([]);
    expect(pack.warnings).toEqual(["No relevant eligible evidence was found."]);
  });

  it("rejects ineligible claim status filters for trusted retrieval", async () => {
    const { useCase } = createUseCase({ structured: [] });

    await expect(useCase.execute({ query: "TypeScript", claimStatus: "rejected" }))
      .rejects.toThrow("Claim status filter must be confirmed or single_source for trusted retrieval.");
  });

  it("ranks confirmed claims above equivalent single-source claims", async () => {
    const { useCase } = createUseCase({
      structured: [
        structuredCandidate({ evidenceClaimId: "claim-b", claimStatus: "single_source" }),
        structuredCandidate({ evidenceClaimId: "claim-a", claimStatus: "confirmed" })
      ]
    });

    const pack = await useCase.execute({ query: "TypeScript" });

    expect(pack.items.map((item) => item.evidenceClaimId)).toEqual(["claim-a", "claim-b"]);
  });

  it("uses stable identities as deterministic tie-breakers", async () => {
    const { useCase } = createUseCase({
      structured: [
        structuredCandidate({ evidenceClaimId: "claim-b", knowledgeAssetId: "asset-b" }),
        structuredCandidate({ evidenceClaimId: "claim-a", knowledgeAssetId: "asset-a" })
      ]
    });

    const pack = await useCase.execute({ query: "TypeScript" });

    expect(pack.items.map((item) => item.evidenceClaimId)).toEqual(["claim-a", "claim-b"]);
  });

  it("applies limit and minimum score after merge and ranking", async () => {
    const { useCase } = createUseCase({
      structured: [
        structuredCandidate({ evidenceClaimId: "claim-high", structuredScore: 1, confidenceScore: 90 }),
        structuredCandidate({ evidenceClaimId: "claim-low", structuredScore: 0.1, confidenceScore: 10 })
      ]
    });

    const pack = await useCase.execute({ query: "TypeScript", limit: 1, minScore: 0.5 });

    expect(pack.items.map((item) => item.evidenceClaimId)).toEqual(["claim-high"]);
    expect(pack.items[0].finalScore).toBeGreaterThanOrEqual(0.5);
  });
});
