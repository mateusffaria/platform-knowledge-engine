## Why

The first Job Analyzer release validates and preserves provenance, but its broad prompt and unnormalized signal shape can turn ambiguity into unsupported competencies, conflate collaboration with leadership, and lose valuable source context. Downstream retrieval needs conservative, canonical, and repeatable analysis signals without invalidating analyses already stored by the first release.

## What Changes

- Refine the Job Analyzer contract and prompt to make the narrowest defensible inference, prefer omission when evidence is insufficient, and reject clearly unsupported competency expansion even when an output includes source references or warnings.
- Split cross-team collaboration signals from cross-team leadership signals and retain each as a distinct retrieval-enrichment category.
- Replace free-form domain signal values with canonical values plus preserved source wording, and normalize equivalent domain variations deterministically.
- Refine seniority signals to include a canonical level, source value, signal type, and source reference; represent the absence of explicit seniority without inventing a level.
- Introduce a documented deterministic reanalysis/versioning policy so repeated analysis can be recognized, reused, or versioned predictably while prior persisted analyses remain readable.
- Version the prompt and update Job Analyzer documentation and focused behavioral tests.

## Capabilities

### New Capabilities

- `job-analysis-agent`: Conservative, source-aware, normalized Job Analyzer output, compatibility behavior, and deterministic reanalysis selection for job retrieval enrichment.

### Modified Capabilities

- None.

## Impact

- Affects the jobs-domain analysis model, Zod output schema and normalization, prompt, analyzer orchestration, analysis repository/persistence compatibility, retrieval-intent enrichment, and `src/modules/jobs/README.md`.
- Adds focused tests for unsupported inference, collaboration versus leadership, domain normalization, missing seniority, compatibility with existing snapshots, and repeat-analysis versioning.
- Keeps deterministic job ingestion, canonical requirements, PKQL filters, professional knowledge, and Evidence Pack generation unchanged.
