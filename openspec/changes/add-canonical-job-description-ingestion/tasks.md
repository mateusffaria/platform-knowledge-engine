## 1. Data Model and Module Setup

- [x] 1.1 Create jobs module folders for domain, application ports, application use cases, infrastructure, and CLI interfaces
- [x] 1.2 Define Job Description, Job Requirement, requirement type, requirement importance, source location, and retrieval intent domain types
- [x] 1.3 Add job description and job requirement tables, enums, indexes, and relations to the shared Drizzle schema
- [x] 1.4 Generate and review an additive migration for the new job-specific database objects
- [x] 1.5 Add repository port contracts for saving, loading, and listing persisted job descriptions and requirements

## 2. Deterministic Job Parsing and Persistence

- [x] 2.1 Implement a JobSourceParser port and deterministic Markdown/plain-text parser adapter
- [x] 2.2 Parse job title, raw content metadata, source path, content hash, and ingestion timestamp
- [x] 2.3 Detect common requirement, qualification, responsibility, nice-to-have, and preferred qualification sections
- [x] 2.4 Extract bullet and paragraph requirements with canonical type, importance, normalized value when available, original text, source excerpt, line locator, and section label
- [x] 2.5 Preserve unmatched requirement text for semantic retrieval and explicitly mark inferred extraction signals
- [x] 2.6 Implement a Drizzle jobs repository that persists a job description and its requirements atomically

## 3. Jobs Application Use Cases

- [x] 3.1 Implement IngestJobDescription with validation for supported file types and empty content
- [x] 3.2 Implement ShowJobDescription with clear not-found errors
- [x] 3.3 Implement BuildJobRetrievalIntent with deterministic ordering, deduplication, source requirement ids, semantic text, PKQL-compatible query text, and warnings
- [x] 3.4 Map supported normalized skill, technology, role, project, type, and status-compatible signals to canonical PKQL fields
- [x] 3.5 Keep unsupported values, responsibilities, experience, education, language, domain, and ambiguous seniority signals in semantic text unless a precise PKQL mapping exists
- [x] 3.6 Verify jobs application code does not import retrieval infrastructure, database adapters, provider SDKs, or CLI code

## 4. CLI and Composition

- [x] 4.1 Add production jobs service composition using the parser, repository, and jobs use cases
- [x] 4.2 Register a `jobs` command group from the CLI entry point
- [x] 4.3 Implement `pke jobs ingest <file>` with concise success output and JSON output when requested
- [x] 4.4 Implement `pke jobs show <job-id>` with grouped human output and JSON output when requested
- [x] 4.5 Implement `pke jobs retrieve <job-id>` by building a job retrieval intent, calling the existing hybrid retrieval use case, and printing an Evidence Pack
- [x] 4.6 Support `--limit`, `--min-score`, `--claim-status`, `--subject-type`, `--verbose`, and `--json` options for job retrieval using existing retrieval validation semantics

## 5. Tests and Verification

- [x] 5.1 Add parser unit tests for Markdown sections, plain-text sections, required requirements, preferred requirements, responsibilities, inferred signals, and source locations
- [x] 5.2 Add domain/use-case tests for ingestion validation, atomic persistence behavior, show not-found behavior, and deterministic retrieval intent generation
- [x] 5.3 Add intent tests for PKQL mapping, semantic fallback, required-before-preferred ordering, deduplication, and inferred requirement traceability
- [x] 5.4 Add CLI tests for jobs ingest, jobs show, jobs retrieve, JSON output, validation errors, and unchanged existing retrieval command behavior
- [x] 5.5 Add architecture boundary tests or import checks for jobs application dependencies
- [x] 5.6 Run `npm run typecheck` and `npm test`

## 6. Documentation

- [x] 6.1 Update architecture documentation with the Job Source to Evidence Pack flow and module ownership boundaries
- [x] 6.2 Update retrieval or jobs documentation with job retrieval intent behavior, PKQL mapping, semantic fallback, and deterministic parser limitations
- [x] 6.3 Update roadmap documentation with the canonical job description ingestion milestone and remaining out-of-scope items
