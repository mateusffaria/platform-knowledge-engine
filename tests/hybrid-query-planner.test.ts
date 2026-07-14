import { describe, expect, it } from "vitest";

import { KnowledgeMetadataProvider } from "../src/modules/retrieval/application/ports/knowledge-metadata-provider.js";
import { parsePkqlQuery } from "../src/modules/retrieval/application/pkql-parser.js";
import { QueryPlanner } from "../src/modules/retrieval/application/query-planner.js";

const metadataProvider: KnowledgeMetadataProvider = {
  async getMetadata() {
    return {
      skills: ["TypeScript"],
      technologies: ["Temporal"],
      companies: ["Acme"],
      projects: ["Atlas"],
      roles: ["Staff Engineer"]
    };
  }
};

describe("Hybrid query planner", () => {
  it("selects structured retrieval for filter-only PKQL queries", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan(parsePkqlQuery("company:Acme"));

    expect(plan.strategies).toEqual(["structured"]);
    expect(plan.semanticText).toBe("");
    expect(plan.filters).toEqual([expect.objectContaining({ field: "company" })]);
  });

  it("selects semantic retrieval for conceptual ASTs", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan(parsePkqlQuery("evidence of leadership impact"));

    expect(plan.strategies).toEqual(["semantic"]);
    expect(plan.structuredTerms).toEqual([]);
  });

  it("selects both strategies for mixed PKQL and semantic text", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan(
      parsePkqlQuery("technology:Temporal leadership impact")
    );

    expect(plan.strategies).toEqual(["structured", "semantic"]);
    expect(plan.semanticText).toBe("leadership impact");
    expect(plan.filters).toEqual([expect.objectContaining({ field: "technology" })]);
  });

  it("uses current metadata for exact bare terms without planner vocabulary changes", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan(parsePkqlQuery("Temporal"));

    expect(plan.strategies).toEqual(["structured"]);
    expect(plan.structuredTerms).toEqual(["temporal"]);
  });

  it("keeps unknown bare terms semantic", async () => {
    const plan = await new QueryPlanner({
      async getMetadata() {
        return {
          skills: [],
          technologies: [],
          companies: [],
          projects: [],
          roles: []
        };
      }
    }).plan(parsePkqlQuery("Temporal"));

    expect(plan.strategies).toEqual(["semantic"]);
    expect(plan.structuredTerms).toEqual([]);
  });

  it("does not use stopword-dependent classification for semantic text", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan(parsePkqlQuery("show evidence"));

    expect(plan.strategies).toEqual(["semantic"]);
  });
});
