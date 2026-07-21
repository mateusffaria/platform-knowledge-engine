# Canonical Professional Profile

`professional-profile/v1` is the canonical candidate input for deterministic resume generation. It is a manually authored or normalized Markdown file with a small YAML front matter contract and fixed English schema labels. The `language` value describes the content language; the headings and field labels remain the same for `en` and `pt-BR`.

## Minimal valid profile

```markdown
---
schema: professional-profile/v1
language: en
---

# Candidate

- Name: Mateus Faria
```

Both front-matter values must be scalar strings. Supported languages are `en` and `pt-BR`. `Name` is the only required Candidate field. Optional fields are:

- `Headline`
- `Location`
- `Email`
- `Phone`
- `LinkedIn`
- `GitHub`
- `Website`

Fields use the exact labels above and can appear at most once. Values are trimmed at their boundaries and otherwise preserved verbatim. Unknown fields and sections remain in the stored raw Markdown but are not projected into Candidate metadata or silently interpreted.

## Canonical sections

The schema recognizes these top-level headings:

```text
# Candidate
# Professional Summary
# Professional Experience
# Technical Skills
# Education
# Certifications
```

Professional Experience entries use level-two organization headings, explicit labeled fields, and optional level-three Achievements and Technologies lists. Technical Skills uses level-two category headings. Education and Certifications use level-two item headings followed by labeled details. Complete English and Brazilian Portuguese content examples are available at:

- `examples/profiles/canonical-professional-profile-v1.md`
- `examples/profiles/canonical-professional-profile-v1-pt-BR.md`

## Metadata and evidence boundary

Candidate Name, Headline, Location, contacts, and links are presentation metadata. Ingestion stores one nested, allowlisted `professionalProfile` projection in the existing source metadata JSON associated with the `professional_profile` asset. These values do not create evidence claims, enter claim review, or become retrieval candidates.

Professional Summary, Professional Experience, Technical Skills, Education, and Certifications are professional knowledge. Supported facts from those sections produce canonical assets, atomic evidence claims, source references, original section labels, and line locators.

Resume generation reads only Candidate presentation fields from the canonical profile. Its visible body remains bounded by the selected `ResumeContentPlan`; ingesting text in another profile section does not authorize the renderer to copy it. Candidate metadata participates in rendering identity and retains source/profile-asset provenance.

## Ingestion and validation

```bash
npm run pke -- ingest examples/profiles/canonical-professional-profile-v1.md
npm run pke -- ingest examples/profiles/canonical-professional-profile-v1-pt-BR.md --json
```

A file declaring any `professional-profile/*` schema is handled by the strict schema-aware parser. Unsupported schema versions, unsupported languages, duplicate schema/language keys, duplicate canonical sections or Candidate fields, and a missing explicit Name fail before persistence with issue codes and paths. Undeclared Markdown retains the legacy generic ingestion path.

Generation reports two independent required-input errors:

- `missing_candidate_name` points to the canonical Candidate Name and recommends ingesting or correcting the profile.
- `missing_renderable_experience` points to `ResumeContentPlan.plannedExperiences` and recommends correcting or regenerating the plan.

Missing optional contact fields never block generation and never produce placeholders.

## Manual normalization and MVP limits

Existing resumes in PDF or DOCX must be reviewed and manually normalized into this Markdown structure. The MVP does not perform PDF/DOCX parsing, OCR, automatic conversion, schema inference, localized label mapping, content translation, source-layout reproduction, or arbitrary profile-to-resume copying. Keep original source meaning intact and do not add facts while normalizing.
