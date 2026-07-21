## Context

The project is a local-first TypeScript CLI organized as a modular monolith. Professional source ingestion, trusted knowledge reconciliation, PKQL parsing, metadata-driven query planning, hybrid retrieval, and Evidence Pack generation already exist, while `src/modules/jobs` is currently a placeholder.

Job descriptions are a new source of retrieval intent, not a new source of professional evidence. The jobs module should own job descriptions and job requirements, but retrieval must continue to own query planning, hybrid search execution, ranking, and Evidence Pack generation.

## Goals / Non-Goals

**Goals:**

- Add a jobs bounded module with domain, application ports/use cases, infrastructure adapters, and CLI adapter.
- Persist raw job descriptions and extracted requirements with source excerpts and line-based source locations.
- Parse Markdown and plain text deterministically without LLM or embedding-provider credentials.
- Build a deterministic retrieval intent from persisted requirements using existing canonical PKQL fields where possible.
- Route job-specific retrieval through the existing hybrid retrieval application contract.
- Preserve existing `pke retrieve` and semantic search behavior.

**Non-Goals:**

- URL scraping, ATS scoring, resume generation, cover letter generation, automatic job applications, benchmarking, and LLM-based job analysis.
- Treating a job description as verified professional knowledge.
- Adding new external parsing, embedding, or AI dependencies.

## Decisions

### Create a jobs module with its own domain and persistence

`src/modules/jobs` will follow the existing hexagonal layout:

- `domain` for `JobDescription`, `JobRequirement`, `JobRequirementType`, `JobRequirementImportance`, `JobSourceLocation`, and `JobRetrievalIntent`.
- `application/ports` for `JobSourceParser` and job persistence.
- `application/use-cases` for `IngestJobDescription`, `ShowJobDescription`, and `BuildJobRetrievalIntent`.
- `infrastructure` for deterministic file parsing and Drizzle repositories.
- `interfaces/cli` for `pke jobs ...` command registration.

Alternative considered: place job parsing under ingestion. That would blur ownership because career ingestion creates professional evidence, while job ingestion creates external requirements used to query evidence.

### Store job descriptions separately from source documents

New database tables will represent job descriptions and requirements rather than reusing `source_documents`, `knowledge_assets`, or `evidence_claims`. A job description is not professional evidence and should not participate in reconciliation, indexing, or claim eligibility.

The persistence model should include raw content, content hash, source path, title when detected, created timestamp, requirement type, importance, normalized value when available, original text, source excerpt, line locator, section label, and an explicit inferred flag.

Alternative considered: store job requirements as knowledge assets. That would make external job needs look like candidate facts, which would pollute retrieval and trust semantics.

### Parse deterministically with conservative extraction

The initial parser will split Markdown and plain text into sections and bullet-like items. Section labels such as Requirements, Qualifications, Responsibilities, Nice to have, and Preferred qualifications determine default requirement type and importance. Text that cannot be confidently normalized remains original semantic text.

The parser may infer requirement type from explicit phrases in a bullet, but it must not fabricate missing requirements. Any inference must be marked `inferred` and preserve the exact source excerpt that caused it.

Alternative considered: introduce LLM-based extraction now. That is out of scope and would weaken repeatability and local-first operation.

### Emit retrieval input instead of running retrieval inside jobs application code

`BuildJobRetrievalIntent` will return a deterministic intent containing a PKQL-compatible query string, structured filters/terms, semantic text, source requirement ids, and warnings. The jobs application layer will not import retrieval infrastructure.

The CLI/composition layer can depend on both jobs and retrieval application contracts: `pke jobs retrieve <job-id>` loads the job, builds intent, calls `HybridSearch`, and prints the returned Evidence Pack using the retrieval output shape.

Alternative considered: create a jobs application use case that directly calls retrieval. That would be acceptable only through a port, but the first implementation can stay simpler by keeping cross-module orchestration in composition.

### Map only supported canonical fields into PKQL

The intent builder will use supported PKQL fields such as `skill`, `technology`, `role`, `project`, `type`, and trusted status filters when the requirement type and normalized value map cleanly. Requirements such as responsibility, experience, seniority, domain, education, language, or unknown values remain semantic text unless a precise canonical mapping exists.

This preserves unknown information for semantic retrieval instead of discarding it or inventing unsupported filters.

## Risks / Trade-offs

- Deterministic parsing may miss nuanced requirements -> keep unmatched text as semantic retrieval text and document known limitations.
- Section heuristics may misclassify unconventional job descriptions -> preserve provenance, make parser behavior easy to test, and keep inferred requirements explicitly marked.
- PKQL query strings may grow long for large job descriptions -> deduplicate normalized terms, cap repeated semantic fragments, and include warnings when truncation is introduced.
- Cross-module CLI orchestration can become awkward as job retrieval grows -> promote the orchestration behind an application port if multiple adapters need it later.
- Database migrations add new persistent state -> use additive tables/enums and keep rollback to dropping new job-specific objects.

## Migration Plan

1. Add Drizzle enums and tables for job descriptions and job requirements.
2. Generate and apply an additive migration.
3. Implement the jobs module domain, ports, deterministic parser, repositories, use cases, and CLI registration.
4. Add focused unit tests for parsing, normalization, intent generation, persistence mapping, and CLI behavior.
5. Update architecture and roadmap documentation.

Rollback is straightforward before users depend on the feature: remove CLI registration and drop the new job-specific tables/enums. Existing professional knowledge, retrieval, and Evidence Pack tables are unaffected.

## Open Questions

- Should `pke jobs retrieve` default to trusted statuses only by adding `status:confirmed` or rely on the existing hybrid retrieval trusted-evidence policy?
- Should repeated ingestion of the same path and content return the existing job id or create a new job description version?
