import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function readTypescriptFiles(directory: string): Promise<Array<{ path: string; contents: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readTypescriptFiles(entryPath);
      }
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        return [{ path: entryPath, contents: await readFile(entryPath, "utf8") }];
      }

      return [];
    })
  );

  return files.flat();
}

describe("Architecture boundaries", () => {
  it("keeps knowledge domain independent from application, infrastructure, shared services, and SDKs", async () => {
    const files = await readTypescriptFiles("src/modules/knowledge/domain");
    const forbiddenImports = [
      "../application",
      "../infrastructure",
      "../../application",
      "../../infrastructure",
      "../../../shared",
      "drizzle-orm",
      "postgres",
      "@opentelemetry",
      "pino"
    ];

    for (const file of files) {
      for (const forbiddenImport of forbiddenImports) {
        expect(file.contents, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
      }
    }
  });

  it("keeps the executable CLI registry out of direct infrastructure concerns", async () => {
    const contents = await readFile("src/cli/index.ts", "utf8");
    const forbiddenImports = [
      "shared/database",
      "shared/observability",
      "shared/logging",
      "infrastructure/parsers",
      "infrastructure/repositories",
      "DrizzleKnowledgePersistence",
      "createDatabase"
    ];

    for (const forbiddenImport of forbiddenImports) {
      expect(contents, `src/cli/index.ts imports ${forbiddenImport}`).not.toContain(forbiddenImport);
    }
  });
});
