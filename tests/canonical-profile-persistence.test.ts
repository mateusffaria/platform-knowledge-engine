import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { parseMarkdownCareerDocument } from "../src/modules/ingestion/infrastructure/parsers/markdown.js"
import { DrizzleCandidateResumeMetadataReader } from "../src/modules/documents/infrastructure/repositories/drizzle-candidate-resume-metadata-reader.js"
import { DrizzleKnowledgePersistence } from "../src/modules/knowledge/infrastructure/repositories/drizzle-knowledge-persistence.js"
import { createDatabase } from "../src/shared/database/client.js"
import { evidenceClaims, sourceDocuments } from "../src/shared/database/schema.js"

const databaseIntegrationEnabled = process.env.PKE_DATABASE_INTEGRATION === "1"
const databaseUrl = process.env.DATABASE_URL ?? "postgres://pke:pke@localhost:5432/pke"

describe.skipIf(!databaseIntegrationEnabled)("canonical profile persistence", () => {
  const ids: string[] = []
  let database: ReturnType<typeof createDatabase>

  beforeAll(() => { database = createDatabase(databaseUrl) })
  afterAll(async () => {
    if (ids.length > 0) await database.db.delete(sourceDocuments).where(inArray(sourceDocuments.id, ids))
    await database.close()
  })

  it("atomically round-trips canonical metadata, evidence separation, and source-version deduplication", async () => {
    const raw = await readFile("examples/profiles/canonical-professional-profile-v1.md", "utf8")
    const sourcePath = `integration://${randomUUID()}/canonical-profile.md`
    const first = parseMarkdownCareerDocument(sourcePath, raw)
    const duplicate = parseMarkdownCareerDocument(sourcePath, raw)
    ids.push(first.source.id, duplicate.source.id)
    const persistence = new DrizzleKnowledgePersistence(database.db)
    await persistence.saveCanonicalCareerDocument(first)
    await persistence.saveCanonicalCareerDocument(duplicate)

    const storedSources = await database.db.select().from(sourceDocuments).where(eq(sourceDocuments.path, sourcePath))
    expect(storedSources).toHaveLength(1)
    expect(storedSources[0].metadata).toMatchObject({ professionalProfile: { schema: "professional-profile/v1", language: "en", candidate: { name: "Mateus Faria" } } })
    const claims = await database.db.select().from(evidenceClaims).where(eq(evidenceClaims.sourceLanguage, "en"))
    const sourceClaims = claims.filter((claim) => first.evidenceClaims.some((expected) => expected.id === claim.id))
    expect(sourceClaims.length).toBeGreaterThan(0)
    expect(sourceClaims.every((claim) => claim.originalSectionLabel !== "Candidate")).toBe(true)

    const candidate = await new DrizzleCandidateResumeMetadataReader(database.db).read({ curatedEvidencePack: { id: "pack", jobDescriptionId: "job", requirementCoverage: [] }, selectedEvidenceIds: [], discardedEvidenceIds: [], sourceDocumentIds: [storedSources[0].id] })
    expect(candidate).toMatchObject({ name: { value: "Mateus Faria" }, email: { value: "mateus@example.com" }, profileSourceDocumentId: storedSources[0].id })
  })

  it("rolls back the source row when canonical asset persistence fails", async () => {
    const raw = ["---", "schema: professional-profile/v1", "language: en", "---", "", "# Candidate", "- Name: Rollback Candidate"].join("\n")
    const document = parseMarkdownCareerDocument(`integration://${randomUUID()}/rollback.md`, raw)
    ids.push(document.source.id)
    document.assets.push({ ...document.asset })
    await expect(new DrizzleKnowledgePersistence(database.db).saveCanonicalCareerDocument(document)).rejects.toBeDefined()
    await expect(database.db.select().from(sourceDocuments).where(eq(sourceDocuments.id, document.source.id))).resolves.toEqual([])
  })
})
