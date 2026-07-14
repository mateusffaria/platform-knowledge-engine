import { describe, expect, it } from "vitest";

import { PkqlParseError, parsePkqlQuery } from "../src/modules/retrieval/application/pkql-parser.js";

describe("PKQL parser", () => {
  it("parses every supported filter field", () => {
    const query = parsePkqlQuery(
      "company:Acme role:Engineer technology:TypeScript skill:Testing project:Atlas status:confirmed after:2020 before:2024 type:achievement"
    );

    expect(query.filters.map((filter) => filter.field)).toEqual([
      "company",
      "role",
      "technology",
      "skill",
      "project",
      "status",
      "after",
      "before",
      "type"
    ]);
    expect(query.filters.find((filter) => filter.field === "after")?.value).toMatchObject({
      kind: "date",
      value: "2020"
    });
    expect(query.semanticText).toBe("");
  });

  it("removes quotes from quoted values while retaining the original value token", () => {
    const query = parsePkqlQuery('project:"Professional Knowledge Engine"');

    expect(query.filters).toEqual([{
      field: "project",
      value: {
        kind: "text",
        value: "Professional Knowledge Engine",
        rawValue: '"Professional Knowledge Engine"'
      }
    }]);
    expect(query.semanticText).toBe("");
    expect(query.diagnostics).toEqual([]);
  });

  it("reports an actionable diagnostic for an ambiguous unquoted compound value", () => {
    const query = parsePkqlQuery("company:Acme Knowledge Systems");

    expect(query.filters).toEqual([expect.objectContaining({
      field: "company",
      value: expect.objectContaining({ value: "Acme" })
    })]);
    expect(query.semanticText).toBe("Knowledge Systems");
    expect(query.diagnostics).toEqual([expect.objectContaining({
      message: expect.stringContaining('Quote compound values, for example company:"Acme ...".')
    })]);
  });

  it("separates filters from mixed semantic text", () => {
    const query = parsePkqlQuery("company:VTEX distributed systems observability");

    expect(query.filters).toEqual([expect.objectContaining({
      field: "company",
      value: expect.objectContaining({ value: "VTEX" })
    })]);
    expect(query.semanticText).toBe("distributed systems observability");
  });

  it("keeps natural-language queries as semantic text", () => {
    const query = parsePkqlQuery("show evidence of platform leadership");

    expect(query.filters).toEqual([]);
    expect(query.semanticText).toBe("show evidence of platform leadership");
  });

  it("rejects unsupported explicit filters", () => {
    expect(() => parsePkqlQuery("team:Platform observability"))
      .toThrow('Unsupported PKQL filter "team". Supported filters: company, role, technology, skill, project, status, after, before, type.');
  });

  it("rejects empty retrieval queries", () => {
    expect(() => parsePkqlQuery("   ")).toThrow(PkqlParseError);
    expect(() => parsePkqlQuery("   ")).toThrow("Retrieval query must not be empty.");
  });
});
