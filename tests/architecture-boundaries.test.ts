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

function importedSpecifiers(contents: string): string[] {
  return Array.from(contents.matchAll(/from\s+["']([^"']+)["']/g))
    .map((match) => match[1]);
}

describe("Architecture boundaries", () => {
  it("keeps resume rendering domain and application independent from infrastructure SDKs", async () => {
    const files = [
      ...(await readTypescriptFiles("src/modules/documents/domain")),
      ...(await readTypescriptFiles("src/modules/documents/application"))
    ]
    const forbiddenImports = [
      "/infrastructure/",
      "shared/database",
      "node:fs",
      "playwright",
      "pdfjs-dist",
      "drizzle-orm",
      "postgres",
      "@opentelemetry",
      "pino"
    ]

    for (const file of files) {
      for (const imported of importedSpecifiers(file.contents)) {
        for (const forbiddenImport of forbiddenImports) expect(imported, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport)
      }
    }
  })

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

  it("keeps reconciliation isolated from other modules' infrastructure and persistence details", async () => {
    const files = await readTypescriptFiles("src/modules/reconciliation");
    const forbiddenImports = [
      "modules/knowledge/infrastructure",
      "modules/retrieval/infrastructure",
      "../knowledge/infrastructure",
      "../retrieval/infrastructure",
      "../../knowledge/infrastructure",
      "../../retrieval/infrastructure",
      "../../../shared/database",
      "../../../../shared/database",
      "shared/database",
      "drizzle-orm",
      "pgvector",
      "embedding-providers",
      "vector-stores"
    ];

    for (const file of files) {
      for (const forbiddenImport of forbiddenImports) {
        expect(file.contents, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
      }
    }
  });

  it("keeps reconciliation application code inside domain and port boundaries", async () => {
    const files = await readTypescriptFiles("src/modules/reconciliation/application");
    const forbiddenImports = [
      "../../knowledge",
      "../../../knowledge",
      "../../retrieval",
      "../../../retrieval",
      "../../infrastructure",
      "../infrastructure",
      "../../../shared/database",
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

  it("keeps retrieval application code inside domain and port boundaries", async () => {
    const files = await readTypescriptFiles("src/modules/retrieval/application");
    const forbiddenImports = [
      "../../knowledge/infrastructure",
      "../../../knowledge/infrastructure",
      "../../reconciliation/infrastructure",
      "../../../reconciliation/infrastructure",
      "../infrastructure",
      "../../infrastructure",
      "../../../shared/database",
      "../../../../shared/database",
      "shared/database",
      "drizzle-orm",
      "postgres",
      "embedding-providers",
      "vector-stores"
    ];

    for (const file of files) {
      const imports = importedSpecifiers(file.contents);
      for (const forbiddenImport of forbiddenImports) {
        for (const importSpecifier of imports) {
          expect(importSpecifier, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
        }
      }
    }
  });

  it("keeps jobs application code independent from retrieval infrastructure, persistence, providers, and CLI", async () => {
    const files = await readTypescriptFiles("src/modules/jobs/application");
    const forbiddenImports = [
      "../../retrieval/infrastructure",
      "../../../retrieval/infrastructure",
      "../infrastructure",
      "../../infrastructure",
      "../../../shared/database",
      "drizzle-orm",
      "postgres",
      "embedding-providers",
      "interfaces/cli",
      "llm-providers",
      "infrastructure/observability",
      "shared/observability"
    ];

    for (const file of files) {
      const imports = importedSpecifiers(file.contents);
      for (const forbiddenImport of forbiddenImports) {
        for (const importSpecifier of imports) {
          expect(importSpecifier, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
        }
      }
    }
  });

  it("keeps evidence-reasoning application code bounded to domain and ports", async () => {
    const files = await readTypescriptFiles("src/modules/jobs/application");
    const reasoningFiles = files.filter((file) => /evidence-reason|candidate-evidence|evidence-curation|reason-job-evidence/.test(file.path));
    const forbiddenImports = [
      "retrieval/infrastructure",
      "infrastructure/repositories",
      "shared/database",
      "drizzle-orm",
      "pgvector",
      "postgres",
      "llm-providers",
      "shared/observability"
    ];

    for (const file of reasoningFiles) {
      const imports = importedSpecifiers(file.contents);
      for (const forbiddenImport of forbiddenImports) {
        for (const importSpecifier of imports) {
          expect(importSpecifier, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
        }
      }
    }
  });

  it("keeps evaluation domain and application code independent from infrastructure and delivery adapters", async () => {
    const files = [
      ...await readTypescriptFiles("src/modules/evaluation/domain"),
      ...await readTypescriptFiles("src/modules/evaluation/application")
    ];
    const forbiddenImports = [
      "../infrastructure",
      "../../infrastructure",
      "shared/database",
      "drizzle-orm",
      "postgres",
      "commander",
      "langfuse",
      "llm-providers",
      "vector-stores",
      "interfaces/cli"
    ];

    for (const file of files) {
      const imports = importedSpecifiers(file.contents);
      for (const forbiddenImport of forbiddenImports) {
        for (const importSpecifier of imports) {
          expect(importSpecifier, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
        }
      }
    }
  });

  it("keeps documents domain and application code inside explicit planning and rendering ports", async () => {
    const files = [
      ...await readTypescriptFiles("src/modules/documents/domain"),
      ...await readTypescriptFiles("src/modules/documents/application")
    ];
    const forbiddenImports = [
      "../infrastructure",
      "../../infrastructure",
      "jobs/infrastructure",
      "retrieval",
      "shared/database",
      "drizzle-orm",
      "postgres",
      "pgvector",
      "@opentelemetry",
      "langfuse",
      "commander",
      "interfaces/cli"
    ];

    for (const file of files) {
      const imports = importedSpecifiers(file.contents);
      for (const forbiddenImport of forbiddenImports) {
        for (const importSpecifier of imports) {
          expect(importSpecifier, `${file.path} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
        }
      }
    }
  });
});
