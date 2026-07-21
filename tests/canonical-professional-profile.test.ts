import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { parseMarkdownCareerDocument } from "../src/modules/ingestion/infrastructure/parsers/markdown.js"
import { parseMarkdownFrontmatter } from "../src/modules/ingestion/infrastructure/parsers/frontmatter.js"
import { validateProfessionalProfileV1 } from "../src/modules/ingestion/infrastructure/parsers/professional-profile-v1.js"
import { ProfessionalProfileValidationError, readProfessionalProfileV1Metadata } from "../src/modules/knowledge/domain/professional-profile.js"

function profile(body: string, frontmatter = ["schema: professional-profile/v1", "language: en"]): string {
  return ["---", ...frontmatter, "---", "", body].join("\n")
}

function issueCodes(action: () => unknown): string[] {
  try {
    action()
    return []
  } catch (error) {
    expect(error).toBeInstanceOf(ProfessionalProfileValidationError)
    return (error as ProfessionalProfileValidationError).issues.map((issue) => issue.code)
  }
}

describe("professional-profile/v1 validation", () => {
  it.each(["en", "pt-BR"])("accepts a minimal %s profile with only an explicit Name", (language) => {
    const document = parseMarkdownCareerDocument("profile.md", profile("# Candidate\n\n- Name:  Mateus Faria  ", ["schema: professional-profile/v1", `language: ${language}`]))
    expect(readProfessionalProfileV1Metadata(document.source.metadata.professionalProfile)).toEqual({
      schema: "professional-profile/v1",
      language,
      candidate: { name: "Mateus Faria" }
    })
    expect(document.asset.title).toBe("Mateus Faria")
    expect(document.evidenceClaims).toEqual([])
  })

  it("reports missing, sequence, duplicate, and unsupported schema declarations", () => {
    expect(issueCodes(() => validateProfessionalProfileV1(parseMarkdownFrontmatter(profile("# Candidate\n- Name: Mateus", ["language: en"]))))).toContain("missing_schema")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Candidate\n- Name: Mateus", ["schema: [professional-profile/v1]", "language: en"])))).toContain("invalid_schema_type")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Candidate\n- Name: Mateus", ["schema: professional-profile/v1", "schema: professional-profile/v1", "language: en"])))).toContain("duplicate_schema")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Candidate\n- Name: Mateus", ["schema: professional-profile/v2", "language: en"])))).toContain("unsupported_schema")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", ["---", "schema: professional-profile/v1", "language: en", "# Candidate", "- Name: Mateus"].join("\n")))).toContain("unclosed_frontmatter")
  })

  it("reports missing, sequence, duplicate, and unsupported language declarations", () => {
    const body = "# Candidate\n- Name: Mateus"
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile(body, ["schema: professional-profile/v1"])))).toContain("missing_language")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile(body, ["schema: professional-profile/v1", "language: [en] "])))).toContain("invalid_language_type")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile(body, ["schema: professional-profile/v1", "language: en", "language: pt-BR"])))).toContain("duplicate_language")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile(body, ["schema: professional-profile/v1", "language: es"])))).toContain("unsupported_language")
  })

  it("requires one Candidate section and one non-empty, non-duplicate Name", () => {
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Professional Summary\nText")))).toEqual(expect.arrayContaining(["missing_candidate_section", "missing_candidate_name"]))
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Candidate\n- Name:")))).toContain("missing_candidate_name")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Candidate\n- Name: First\n- Name: Second")))).toContain("duplicate_candidate_field")
    expect(issueCodes(() => parseMarkdownCareerDocument("profile.md", profile("# Candidate\n- Name: Mateus\n- Email: one@example.com\n- Email: two@example.com")))).toContain("duplicate_candidate_field")
  })

  it("preserves unknown content without projecting it", () => {
    const raw = profile("# Candidate\n- Name: Mateus\n- Mastodon: https://social.example/alex\n\n# Interests\n- Cycling")
    const document = parseMarkdownCareerDocument("profile.md", raw)
    expect(document.source.rawContent).toBe(raw)
    expect(document.source.metadata.professionalProfile).toEqual({ schema: "professional-profile/v1", language: "en", candidate: { name: "Mateus" } })
    expect(JSON.stringify(document.source.metadata.professionalProfile)).not.toContain("Mastodon")
    expect(document.evidenceClaims).toEqual([])
  })
})

describe("professional-profile/v1 canonical conversion", () => {
  it.each([
    "examples/profiles/canonical-professional-profile-v1.md",
    "examples/profiles/canonical-professional-profile-v1-pt-BR.md"
  ])("maps canonical sections and keeps Candidate fields out of evidence for %s", async (filePath) => {
    const raw = await readFile(filePath, "utf8")
    const document = parseMarkdownCareerDocument(filePath, raw)
    const metadata = readProfessionalProfileV1Metadata(document.source.metadata.professionalProfile)
    expect(metadata?.candidate.name).toBeTruthy()
    expect(document.assets.map((asset) => asset.assetType)).toEqual(expect.arrayContaining([
      "professional_profile",
      "professional_experience",
      "organization",
      "role",
      "skill",
      "education"
    ]))
    expect(document.experiences.length).toBeGreaterThan(0)
    expect(document.skills.length).toBeGreaterThan(0)
    expect(document.achievements.length).toBeGreaterThan(0)
    expect(document.evidenceClaims.length).toBeGreaterThan(0)
    expect(document.references.every((reference) => reference.locator.startsWith("line:"))).toBe(true)
    expect(document.evidenceClaims.every((claim) => claim.originalSectionLabel !== "Candidate")).toBe(true)
    expect(document.evidenceClaims.map((claim) => claim.claimText).join("\n")).not.toContain(metadata?.candidate.email ?? "not-present")
    expect(document.source.rawContent).not.toContain("...")
  })

  it("keeps undeclared generic Markdown on the existing parser", () => {
    const document = parseMarkdownCareerDocument("legacy.md", "# Legacy Profile\n\n## Skills\n- TypeScript")
    expect(document.asset.title).toBe("Legacy Profile")
    expect(document.skills.map((skill) => skill.name)).toEqual(["TypeScript"])
    expect(document.source.metadata.professionalProfile).toBeUndefined()
  })
})
