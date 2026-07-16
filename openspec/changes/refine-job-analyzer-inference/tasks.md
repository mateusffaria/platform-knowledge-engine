## 1. Analysis contract and normalization

- [x] 1.1 Define v3 domain types for canonical/source-aware domain signals, source-aware seniority signals, and distinct cross-team collaboration and leadership signal collections.
- [x] 1.2 Implement a code-owned, deterministic domain alias normalizer that preserves source wording and covers the initially supported equivalent variations.
- [x] 1.3 Update the Zod analysis-output parser and source-reference validation for the v3 contract, including required seniority provenance and empty absent-seniority behavior.
- [x] 1.4 Add a legacy-analysis compatibility mapper that converts v2 persisted content to the current read model without inventing collaboration or seniority evidence.

## 2. Conservative analyzer execution

- [x] 2.1 Version the Job Analyzer prompt and output contract with omission-first, narrow-inference, warning, collaboration, leadership, domain, and seniority rules.
- [x] 2.2 Update `JobAnalyzerAgent` orchestration and observability metadata to produce and record the v3 contract while retaining source provenance validation.
- [x] 2.3 Extend the analyzer/provider boundary to resolve provider and effective-model identity before an analysis request, including CLI model overrides.

## 3. Idempotent snapshot persistence

- [x] 3.1 Add the analysis-identity fields and uniqueness constraint to the Drizzle schema; generate an additive migration that leaves existing analysis rows intact.
- [x] 3.2 Extend the job-analysis repository port and Drizzle implementation to find a snapshot by deterministic analysis identity and deserialize legacy or v3 content through the compatibility mapper.
- [x] 3.3 Update the analyze-job use case to reuse a matching successful snapshot before provider invocation and resolve a concurrent unique-identity conflict by loading that snapshot.

## 4. Retrieval and user-facing output

- [x] 4.1 Update retrieval-intent construction to consume the compatibility-mapped signal types as bounded semantic enrichment without changing deterministic PKQL filters.
- [x] 4.2 Update human-readable analysis output for canonical/source domain values, seniority metadata, and separate collaboration and leadership categories while preserving `--json` output.
- [x] 4.3 Document v3 inference boundaries, normalization, legacy readability, and deterministic reanalysis reuse in the jobs module documentation and relevant CLI documentation.

## 5. Verification

- [x] 5.1 Add mocked-provider tests that prove ambiguous source wording does not produce unsupported stakeholder-management or other broadened competencies, regardless of source references or warnings.
- [x] 5.2 Add tests that distinguish cross-team collaboration from explicit cross-team leadership and verify their separate retrieval enrichment.
- [x] 5.3 Add parser and persistence tests for canonical domain normalization with preserved source values, explicit seniority provenance, no-explicit-seniority jobs, and legacy snapshot compatibility.
- [x] 5.4 Add use-case and repository tests for exact repeated-analysis reuse, changed identity snapshot creation, and concurrent duplicate handling.
- [x] 5.5 Run `npm run typecheck` and `npm test`, then resolve any regressions.
