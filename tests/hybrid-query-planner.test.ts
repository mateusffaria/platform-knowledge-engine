import { describe, expect, it } from "vitest";

import { KnowledgeMetadataMatcher } from "../src/modules/retrieval/application/metadata-matcher.js";
import { parsePkqlQuery } from "../src/modules/retrieval/application/pkql-parser.js";
import { QueryPlanner } from "../src/modules/retrieval/application/query-planner.js";
import { MetadataMatch } from "../src/modules/retrieval/application/types.js";

function metadataMatch(overrides: Partial<MetadataMatch> = {}): MetadataMatch {
  return {
    category: "technology",
    value: "Temporal",
    normalizedValue: "temporal",
    matchType: "exact",
    matchedText: "Temporal",
    ...overrides
  };
}

const matcher = new KnowledgeMetadataMatcher({
  async getMetadata() {
    return {
      skills: ["TypeScript"],
      technologies: ["Temporal"],
      organizations: ["Acme Knowledge Systems"],
      projects: ["Atlas"],
      roles: ["Staff Engineer"],
      products: ["Atlas Cloud"],
      initiatives: ["Platform Reliability"],
      aliases: [
        {
          category: "role",
          value: "Staff Engineer",
          alias: "Engenheiro Staff"
        },
        {
          category: "technology",
          value: "Temporal",
          alias: "orquestracao temporal"
        }
      ]
    };
  }
});

const legacyCompanyMatcher = new KnowledgeMetadataMatcher({
  async getMetadata() {
    return {
      skills: [],
      technologies: [],
      organizations: [],
      companies: ["Legacy Company"],
      projects: [],
      roles: [],
      products: [],
      initiatives: []
    };
  }
});

const emptyMatcher = new KnowledgeMetadataMatcher({
  async getMetadata() {
    return {
      skills: [],
      technologies: [],
      organizations: [],
      projects: [],
      roles: [],
      products: [],
      initiatives: []
    };
  }
});

describe("Knowledge metadata matcher", () => {
  it("returns exact, prefix, partial, and alias matches with canonical categories", async () => {
    const exact = await matcher.match(parsePkqlQuery("Temporal"));
    const prefix = await matcher.match(parsePkqlQuery("Acme"));
    const partial = await matcher.match(parsePkqlQuery("evidence of Platform Reliability impact"));
    const alias = await matcher.match(parsePkqlQuery("Engenheiro Staff"));

    expect(exact).toContainEqual(expect.objectContaining({
      category: "technology",
      value: "Temporal",
      normalizedValue: "temporal",
      matchType: "exact"
    }));
    expect(prefix).toContainEqual(expect.objectContaining({
      category: "organization",
      value: "Acme Knowledge Systems",
      matchType: "prefix"
    }));
    expect(partial).toContainEqual(expect.objectContaining({
      category: "initiative",
      value: "Platform Reliability",
      matchType: "partial"
    }));
    expect(alias).toContainEqual(expect.objectContaining({
      category: "role",
      value: "Staff Engineer",
      matchType: "alias",
      alias: "Engenheiro Staff"
    }));
  });

  it("maps legacy companies metadata to canonical organizations", async () => {
    const matches = await legacyCompanyMatcher.match(parsePkqlQuery("Legacy"));

    expect(matches).toEqual([expect.objectContaining({
      category: "organization",
      value: "Legacy Company",
      matchType: "prefix"
    })]);
  });

  it("normalizes English and Portuguese aliases to the same canonical match", async () => {
    const english = await matcher.match(parsePkqlQuery("Staff Engineer"));
    const portuguese = await matcher.match(parsePkqlQuery("Engenheiro Staff"));

    expect(english[0]).toMatchObject({
      category: "role",
      value: "Staff Engineer",
      normalizedValue: "staff engineer"
    });
    expect(portuguese[0]).toMatchObject({
      category: "role",
      value: "Staff Engineer",
      normalizedValue: "staff engineer"
    });
  });

  it("returns no matches when persisted metadata does not match the query", async () => {
    await expect(emptyMatcher.match(parsePkqlQuery("Temporal"))).resolves.toEqual([]);
  });
});

describe("Hybrid query planner", () => {
  it("selects structured retrieval for filter-only PKQL queries without metadata matches", () => {
    const plan = new QueryPlanner().plan(parsePkqlQuery("company:Acme"), []);

    expect(plan.strategies).toEqual(["structured"]);
    expect(plan.semanticText).toBe("");
    expect(plan.filters).toEqual([expect.objectContaining({ field: "company" })]);
  });

  it("selects semantic retrieval for conceptual ASTs with no metadata matches", () => {
    const plan = new QueryPlanner().plan(parsePkqlQuery("evidence of leadership impact"), []);

    expect(plan.strategies).toEqual(["semantic"]);
    expect(plan.structuredTerms).toEqual([]);
    expect(plan.metadataMatches).toEqual([]);
  });

  it("selects both strategies for mixed PKQL and semantic text", () => {
    const plan = new QueryPlanner().plan(parsePkqlQuery("technology:Temporal leadership impact"), []);

    expect(plan.strategies).toEqual(["structured", "semantic"]);
    expect(plan.semanticText).toBe("leadership impact");
    expect(plan.filters).toEqual([expect.objectContaining({ field: "technology" })]);
  });

  it("uses normalized matches for exact bare terms without planner vocabulary changes", () => {
    const match = metadataMatch();
    const plan = new QueryPlanner().plan(parsePkqlQuery("Temporal"), [match]);

    expect(plan.strategies).toEqual(["structured"]);
    expect(plan.structuredTerms).toEqual(["temporal"]);
    expect(plan.metadataMatches).toEqual([match]);
  });

  it("keeps unknown bare terms semantic", () => {
    const plan = new QueryPlanner().plan(parsePkqlQuery("Temporal"), []);

    expect(plan.strategies).toEqual(["semantic"]);
    expect(plan.structuredTerms).toEqual([]);
  });

  it("selects both strategies when metadata matches coexist with conceptual text", () => {
    const plan = new QueryPlanner().plan(parsePkqlQuery("Temporal leadership impact"), [
      metadataMatch({ matchType: "partial", matchedText: "Temporal" })
    ]);

    expect(plan.strategies).toEqual(["structured", "semantic"]);
    expect(plan.structuredTerms).toEqual(["temporal"]);
  });

  it("does not use stopword-dependent classification for semantic text", () => {
    const plan = new QueryPlanner().plan(parsePkqlQuery("show evidence"), []);

    expect(plan.strategies).toEqual(["semantic"]);
  });
});
