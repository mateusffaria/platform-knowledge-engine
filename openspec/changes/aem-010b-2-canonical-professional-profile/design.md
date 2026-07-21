## Context

The generic Markdown ingestion parser currently accepts loosely structured profiles, keeps YAML front matter in `SourceDocument.metadata`, derives the professional-profile title from front matter, a document heading, or the file name, and extracts supported list items as canonical assets and evidence. The completed AEM-010B generation path reads candidate fields from source-document metadata associated with a professional-profile asset and can fall back to the asset title for a name. That behavior does not establish a canonical input contract and cannot parse the explicitly labeled Candidate block in `professional-profile/v1` deterministically.

This follow-up crosses ingestion, the canonical career model, persistence, and documents generation. It must preserve generic Markdown ingestion, the existing database metadata carrier, atomic evidence rules, and the closed-world ResumeContentPlan rendering boundary. Existing PDF or DOCX resumes are source material for manual normalization only.

## Goals / Non-Goals

**Goals:**

- Define and validate one versioned Markdown/YAML profile contract for English and Brazilian Portuguese content.
- Deterministically project explicitly labeled Candidate presentation fields with source provenance.
- Keep presentation metadata out of evidence claims while preserving evidence extraction from professional knowledge sections.
- Make generation require an explicit canonical candidate name, tolerate absent optional contacts, and distinguish name failures from plan renderability failures.
- Preserve existing generic Markdown ingestion and avoid a new storage service or document-conversion dependency.

**Non-Goals:**

- Direct PDF or DOCX ingestion, OCR, resume conversion, or layout preservation.
- Inferring names or contact fields from headings, file names, body prose, or external sources.
- Treating Candidate presentation fields as trusted career evidence or adding them to reconciliation and retrieval.
- Copying arbitrary canonical-profile body sections directly into a resume, expanding the ResumeContentPlan schema, or changing planner prompts in this milestone.
- Translating content, accepting localized aliases for canonical field labels, or introducing another profile schema version.

## Decisions

### 1. Dispatch to a schema-aware parser only when the canonical schema is declared

Front matter is parsed first. An exact scalar `schema: professional-profile/v1` selects a dedicated profile parser and validator; other supported Markdown continues through the current generic parser. Once the canonical schema is claimed, malformed front matter, unsupported language, missing canonical structure, duplicate Candidate fields, and a missing or empty Name are validation failures rather than reasons to fall back to generic parsing.

The canonical parser recognizes the fixed English headings and field labels defined by the schema even when body content is `pt-BR`. This keeps the file grammar versioned and language-neutral while the `language` value describes the authored content. It walks heading levels and labeled list fields explicitly instead of reusing the generic parser's broad heading aliases and list heuristics.

Alternative considered: infer canonical profiles from their section names. Rejected because a small heading change would silently switch parsing modes and make validation dependent on document contents rather than an explicit version contract.

### 2. Store one nested, allowlisted metadata projection

The parser produces a typed projection equivalent to:

```ts
interface ProfessionalProfileV1Metadata {
  schema: "professional-profile/v1"
  language: "en" | "pt-BR"
  candidate: {
    name: string
    headline?: string
    location?: string
    email?: string
    phone?: string
    linkedin?: string
    github?: string
    website?: string
  }
}
```

Values are trimmed at their boundaries but otherwise preserved. Empty optional values are omitted, duplicate labels are rejected, and unknown Candidate labels remain only in raw source content. The projection is stored in the existing `SourceDocument.metadata` JSON object under a versioned `professionalProfile` key. The related `professional_profile` asset remains the knowledge-asset anchor through `sourceDocumentId`; no new table or column is required.

The current `KnowledgeAsset` row has no general metadata column. Adding one solely for these fields would create a migration and duplicate source-owned profile data, so the existing source metadata carrier is preferred. Persistence and read ports expose the projection as professional-profile metadata rather than leaking this storage detail into domain or application code.

Alternative considered: flatten the Candidate values into top-level source metadata keys. Rejected because generic front matter can collide with those names and future schema versions need an unambiguous namespace.

### 3. Separate Candidate projection from evidence-bearing section conversion

Candidate fields are presentation metadata: parsing them creates no SourceReference or EvidenceClaim. `Professional Summary`, `Professional Experience`, `Technical Skills`, `Education`, and `Certifications` continue through canonical career conversion, where supported professional facts create assets, atomic claims, and source references. The schema-aware parser preserves canonical heading and line locators so evidence remains auditable.

This separation is enforced in the parsed model: the Candidate projection is carried on source/profile metadata and is not passed to evidence construction helpers. Tests assert both the positive metadata shape and the absence of claims whose excerpts or claim text merely reproduce Candidate fields.

Alternative considered: create `fact` claims for the candidate name and contacts. Rejected because presentation and routing data are not evidence of professional capability and would pollute claim review, embedding, and retrieval.

### 4. Resolve only explicit canonical metadata during generation

The candidate metadata reader filters eligible source documents to those with a valid `professionalProfile.schema` of `professional-profile/v1`, then uses the existing deterministic source selection order. It reads only the nested Candidate projection and returns its source-document and professional-profile-asset provenance. It does not fall back to asset titles or inspect raw Markdown, claim text, unrelated source metadata, or filenames.

The candidate profile contributes only the header/presentation fields. Professional summary, skills, experience, and any other rendered body content remain bounded by the selected ResumeContentPlan; ingesting a profile does not authorize a renderer to copy unplanned section prose. Optional contact fields are omitted cleanly. Candidate metadata remains part of rendering identity so a corrected profile yields a distinct logical rendering.

Alternative considered: preserve the title fallback for compatibility. Rejected because the new contract makes Name explicit and fallback would mask malformed or legacy input.

### 5. Validate schema, candidate identity, and renderability at separate boundaries

Ingestion validates the canonical file before persistence and reports structured issues with field paths. Generation repeats the minimum integrity checks needed for persisted or legacy data: it reports `missing_candidate_name` for an absent canonical name and `missing_renderable_experience` when the selected plan cannot build at least one template-valid experience. Validation collects independent issues so both can be returned together, while CLI formatting gives each issue its own corrective action.

The missing-name guidance points to ingesting or correcting a `professional-profile/v1` Markdown document. The renderability guidance points to regenerating or correcting the ResumeContentPlan. Neither path attempts automatic repair, planning, inference, or retrieval.

Alternative considered: fail on the first invalid generation input. Rejected because it conflates independently actionable source-profile and plan problems and forces repeated command attempts to discover all blockers.

## Risks / Trade-offs

- [Existing profiles lack the schema marker] → Keep generic ingestion backward compatible, document manual normalization, and require a newly ingested canonical version only for deterministic generation metadata.
- [Exact English labels are stricter for `pt-BR` authors] → Provide complete `en` and `pt-BR` content examples using the same stable schema labels and reject aliases with clear field guidance.
- [Nested metadata can drift from raw Markdown] → Build it only inside the schema-aware parser, persist it atomically with the source version, and cover round-trip reads in database tests.
- [Candidate fields accidentally enter evidence] → Keep projection and evidence construction on separate code paths and assert claim absence in unit and integration tests.
- [A source set contains multiple canonical profiles] → Reuse deterministic ingestion-time and ID tie-breaking, record the chosen source provenance, and test selection explicitly.
- [The new explicit-name rule invalidates title-based generation] → Remove fallback only for the canonical path and return migration guidance instead of guessing.

## Migration Plan

1. Add the typed schema parser, validation issues, metadata projection, and canonical fixtures while preserving the generic Markdown path.
2. Update persistence and read ports to round-trip the nested profile metadata through the existing JSON carrier; no database migration is expected.
3. Update generation to select canonical metadata, remove inferred-name fallback, and report independent name and experience issues.
4. Manually normalize and ingest existing source resumes as new `professional-profile/v1` Markdown source versions; existing generic source records remain intact.
5. Roll back by reverting parser dispatch and reader selection. Stored nested JSON remains harmless to the previous code and does not require destructive data rollback.

## Open Questions

None for `professional-profile/v1`; localized labels, additional Candidate fields, and direct document conversion require a future schema/versioned change.
