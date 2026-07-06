import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

import { loadConfig } from "../config/env.js";

const migrationsDir = path.resolve("drizzle");

async function main(): Promise<void> {
  const config = loadConfig();
  const sql = postgres(config.databaseUrl, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS pke_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await sql<{ name: string }[]>`
        SELECT name FROM pke_migrations WHERE name = ${file}
      `;
      if (existing.length > 0) {
        console.log(`Skipping applied migration ${file}`);
        continue;
      }

      const contents = await readFile(path.join(migrationsDir, file), "utf8");
      const statements = contents
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      await sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }

        await tx`
          INSERT INTO pke_migrations (name) VALUES (${file})
        `;
      });

      console.log(`Applied migration ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
