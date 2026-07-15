## Why

Job-specific retrieval currently depends on a user manually translating a job description into search terms. This change introduces a canonical job model so the Professional Knowledge Engine can ingest a Markdown or plain-text job description, preserve its provenance, and deterministically retrieve relevant verified professional evidence.

## What Changes

- Add a `jobs` module using the existing modular monolith and hexagonal architecture boundaries.
- Introduce canonical job description and job requirement domain models, including requirement type, importance, normalized value, source excerpt, and source location.
- Add deterministic Markdown/plain-text job parsing that detects common sections, classifies explicit requirements, and marks inferred requirements separately.
- Add application ports and use cases for ingesting job descriptions and building job retrieval intents.
- Persist job descriptions and extracted requirements through Drizzle schema and migrations.
- Add CLI commands for `pke jobs ingest <file>`, `pke jobs show <job-id>`, and `pke jobs retrieve <job-id>`.
- Generate retrieval intent from normalized job requirements using canonical PKQL fields and semantic fallback text for unknown or unmatched requirement values.
- Reuse the retrieval module through application contracts so `pke jobs retrieve <job-id>` returns an Evidence Pack without importing retrieval infrastructure into the jobs module.
- Update architecture and roadmap documentation for the job ingestion and retrieval flow.

## Capabilities

### New Capabilities

- `job-description-ingestion`: Ingest, parse, normalize, and persist Markdown or plain-text job descriptions and their extracted requirements with provenance.
- `job-retrieval-intents`: Build deterministic retrieval intents from persisted job requirements and execute job-specific evidence retrieval through existing retrieval contracts.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/modules/jobs`, CLI composition under `src/cli` or module CLI adapters, shared database schema and migrations, retrieval application contracts, tests, and documentation.
- Affected APIs: new jobs CLI commands and internal jobs application use cases/ports.
- Affected systems: local database persistence and existing retrieval/Evidence Pack workflows.
- Dependencies: no new external provider dependency; deterministic parsing and extraction must work without embedding or LLM credentials.
