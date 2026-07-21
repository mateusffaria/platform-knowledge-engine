## Why

Resume generation currently relies on loosely shaped candidate metadata, so it cannot guarantee a deterministic name and contact header from an explicitly supported source format. Defining one canonical Markdown profile now makes ingestion and generation interoperable while keeping presentation-only data out of the evidence model.

## What Changes

- Define `professional-profile/v1` as the canonical candidate input schema: Markdown with required YAML front matter, explicitly labeled candidate fields, and fixed knowledge sections.
- Require `schema: professional-profile/v1`, a supported `language` value (`en` or `pt-BR`), and a non-empty Candidate `Name`; keep the remaining contact and profile fields optional.
- Parse Candidate presentation metadata deterministically and persist it on the professional-profile knowledge asset through the existing metadata mechanism.
- Keep Candidate presentation metadata separate from evidence claims while continuing to extract evidence-backed professional content from the canonical knowledge sections.
- Make resume generation load presentation metadata from the canonical profile and renderable content from the existing `ResumeContentPlan`.
- Report distinct actionable validation errors for a missing candidate name and for missing renderable professional experience; missing optional contact fields do not block generation.
- Document manual normalization of source resumes into the canonical Markdown format; PDF and DOCX profile ingestion remain outside the MVP.

## Capabilities

### New Capabilities

- `canonical-professional-profile`: Defines the versioned Markdown/YAML profile contract, deterministic Candidate metadata projection, generation input boundary, and profile-specific validation behavior.

### Modified Capabilities

- `markdown-ingestion`: Recognize and deterministically parse the versioned canonical profile structure and its explicitly labeled Candidate fields.
- `canonical-career-model`: Store Candidate presentation data as professional-profile asset metadata rather than evidence claims while preserving evidence extraction for professional knowledge sections.
- `knowledge-persistence`: Persist the canonical profile schema, language, and Candidate presentation metadata using the existing knowledge asset metadata mechanism with source traceability.

## Impact

- Affects the Markdown parser and ingestion orchestration, Canonical Career Document/profile mapping, knowledge-asset persistence, and the documents module candidate metadata reader and generation validator.
- Adds canonical English and Brazilian Portuguese profile fixtures plus parser, persistence, generation, CLI, and regression coverage.
- Updates profile examples and ingestion/resume-generation documentation to describe the schema, required normalization, validation errors, and unsupported PDF/DOCX inputs.
- Uses existing JSON metadata storage and introduces no new provider, retrieval, LLM, or document-conversion dependency.
