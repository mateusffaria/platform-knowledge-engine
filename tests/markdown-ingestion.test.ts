import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { assertCanonicalCareerDocument, CanonicalCareerDocument } from "../src/domain/model.js";
import { parseMarkdownCareerDocument, readMarkdownSource, validateMarkdownPath } from "../src/ingestion/markdown.js";
import { ingestMarkdownSource } from "../src/ingestion/pipeline.js";
import { KnowledgePersistence } from "../src/db/persistence.js";

class RecordingPersistence implements KnowledgePersistence {
  public saved: CanonicalCareerDocument[] = [];

  async saveCanonicalCareerDocument(document: CanonicalCareerDocument): Promise<void> {
    assertCanonicalCareerDocument(document);
    this.saved.push(document);
  }
}

describe("Markdown ingestion", () => {
  it("converts the example profile into a Canonical Career Document", async () => {
    const rawContent = await readFile("examples/profile.md", "utf8");
    const document = parseMarkdownCareerDocument("examples/profile.md", rawContent);

    expect(document.source.sourceType).toBe("markdown");
    expect(document.source.rawContent).toContain("# Alex Morgan");
    expect(document.asset.title).toBe("Alex Morgan Professional Profile");
    expect(document.skills.map((skill) => skill.name)).toContain("TypeScript");
    expect(document.experiences[0]).toMatchObject({
      role: "Senior Software Engineer",
      organization: "Acme Knowledge Systems"
    });
    expect(document.projects[0].technologies).toContain("pgvector");
    expect(document.achievements).toHaveLength(2);
    expect(document.evidenceClaims.length).toBe(
      document.skills.length + document.experiences.length + document.projects.length + document.achievements.length
    );
  });

  it("rejects unsupported source file types clearly", () => {
    expect(() => validateMarkdownPath("profile.pdf")).toThrow("Only Markdown ingestion is supported");
  });

  it("reports missing Markdown files clearly", async () => {
    await expect(readMarkdownSource("examples/missing.md")).rejects.toThrow("Source file not found");
  });

  it("persists only evidence-backed canonical career records through the ingestion pipeline", async () => {
    const persistence = new RecordingPersistence();

    const result = await ingestMarkdownSource("examples/profile.md", persistence);

    expect(persistence.saved).toHaveLength(1);
    expect(persistence.saved[0]).toBe(result.document);
    expect(result.document.skills.every((skill) => skill.evidenceClaimIds.length > 0)).toBe(true);
    expect(result.document.skills.every((skill) => skill.sourceReferenceIds.length > 0)).toBe(true);
  });
});
