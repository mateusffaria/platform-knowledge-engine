import { describe, expect, it } from "vitest";

import { DrizzleStructuredKnowledgeSearch } from "../src/modules/knowledge/infrastructure/repositories/drizzle-structured-knowledge-search.js";
import { parsePkqlQuery } from "../src/modules/retrieval/application/pkql-parser.js";

class FakeKnowledgeSearchDatabase {
  constructor(private readonly rows: any[]) {}

  select(): any {
    const query: any = {
      from: () => query,
      innerJoin: () => query,
      leftJoin: () => query,
      then: (resolve: (rows: any[]) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve(this.rows).then(resolve, reject)
    };
    return query;
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-acme",
    knowledgeAssetId: "asset-acme",
    subjectAssetId: "asset-acme",
    claimType: "experience",
    claimCategory: "fact",
    predicate: "works_at",
    claimText: "Led observability work.",
    status: "confirmed",
    confidenceScore: 90,
    experienceOrganization: "Acme Knowledge Systems",
    referenceId: "reference-acme",
    referenceSourceDocumentId: "source-acme",
    referenceExcerpt: "Led observability work.",
    sourceDocumentId: "source-acme",
    ...overrides
  };
}

describe("Drizzle structured knowledge search", () => {
  it("matches unquoted company filters as normalized case-insensitive prefixes", async () => {
    const query = parsePkqlQuery("company:acme");
    const search = new DrizzleStructuredKnowledgeSearch(new FakeKnowledgeSearchDatabase([
      row(),
      row({
        id: "claim-other",
        knowledgeAssetId: "asset-other",
        experienceOrganization: "Other Systems"
      })
    ]));

    const results = await search.search({
      query: query.originalQuery,
      terms: [],
      filters: query.filters,
      limit: 10
    });

    expect(results.map((result) => result.evidenceClaimId)).toEqual(["claim-acme"]);
  });

  it("matches quoted company filters as exact normalized values", async () => {
    const query = parsePkqlQuery('company:"Acme Knowledge Systems"');
    const search = new DrizzleStructuredKnowledgeSearch(new FakeKnowledgeSearchDatabase([
      row(),
      row({
        id: "claim-platform",
        knowledgeAssetId: "asset-platform",
        experienceOrganization: "Acme Knowledge Systems Platform"
      })
    ]));

    const results = await search.search({
      query: query.originalQuery,
      terms: [],
      filters: query.filters,
      limit: 10
    });

    expect(results.map((result) => result.evidenceClaimId)).toEqual(["claim-acme"]);
  });
});
