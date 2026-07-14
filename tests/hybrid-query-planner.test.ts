import { describe, expect, it } from "vitest";

import { KnowledgeMetadataProvider } from "../src/modules/retrieval/application/ports/knowledge-metadata-provider.js";
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
  it("selects structured retrieval for exact professional metadata terms", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan("TypeScript Staff Engineer 2024");

    expect(plan.strategies).toEqual(["structured"]);
    expect(plan.structuredTerms).toEqual(expect.arrayContaining(["typescript", "staff engineer", "2024"]));
  });

  it("selects semantic retrieval for conceptual queries", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan("evidence of leadership impact");

    expect(plan.strategies).toEqual(["semantic"]);
  });

  it("selects both strategies for mixed exact and conceptual queries", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan("evidence of TypeScript leadership impact");

    expect(plan.strategies).toEqual(["structured", "semantic"]);
    expect(plan.structuredTerms).toContain("typescript");
  });

  it("uses current metadata for new technologies without planner code changes", async () => {
    const plan = await new QueryPlanner(metadataProvider).plan("Temporal");

    expect(plan.strategies).toEqual(["structured"]);
    expect(plan.structuredTerms).toContain("temporal");
  });

  it("does not treat technology names as structured unless metadata exposes them", async () => {
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
    }).plan("TypeScript");

    expect(plan.strategies).toEqual(["semantic"]);
    expect(plan.structuredTerms).toEqual([]);
  });

  it("rejects empty queries before reading metadata", async () => {
    await expect(new QueryPlanner(metadataProvider).plan("   ")).rejects.toThrow("Retrieval query must not be empty.");
  });
});
