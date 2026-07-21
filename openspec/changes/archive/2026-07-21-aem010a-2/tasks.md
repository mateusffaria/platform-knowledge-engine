## 1. Atomic Requirement Model and Persistence

- [x] 1.1 Add `AtomicJobRequirement`, parent/component collection, source-span, component-coverage, and structured warning domain types with deterministic component-ID and stable warning-normalization helpers.
- [x] 1.2 Implement conservative deterministic decomposition for independently classified coordinated technologies/skills, singleton fallback, component validation, and stable source ordering.
- [x] 1.3 Add the `job_requirement_components` Drizzle schema, indexes, generated migration, and database migration verification without altering existing parent requirement rows.
- [x] 1.4 Update job-description persistence to save parent requirements and validated components in one transaction and load stored components in source order.
- [x] 1.5 Add the deterministic singleton compatibility adapter for persisted requirements with no component rows and prove that repeated reads do not mutate storage or change component IDs.
- [x] 1.6 Update job ingestion and `jobs show` JSON/human output to expose compound component identity, canonical fields, parent linkage, and provenance.

## 2. Component-Scoped Retrieval and Candidate Preparation

- [x] 2.1 Evolve job retrieval-intent contracts and construction to emit ordered component intents with both parent and component IDs while preserving singleton semantics and analysis enrichment boundaries.
- [x] 2.2 Update requirement-scoped retrieval execution and canonical hydration to retrieve and associate candidates independently for every atomic component.
- [x] 2.3 Evolve Candidate Evidence Pack parent groups to contain component groups with lossless candidates, bounded per-component reasoner selection, and complete discard diagnostics.
- [x] 2.4 Advance the Candidate Evidence Pack version/hash so component ordering, component selections, diagnostics identity, and normalized warnings are represented deterministically.
- [x] 2.5 Add aggregate diagnostics for parent requirement count, atomic component count, and selected-evidence count per component to JSON, concise, verbose, and safe observability output.
- [x] 2.6 Normalize all retrieval/candidate warnings to code and message, adapt legacy strings, deduplicate exact pairs, and stabilize output/hash ordering.

## 3. Component-Level Evidence Reasoning

- [x] 3.1 Evolve reasoner domain contracts, prompt input, prompt version, and JSON Schema so the model evaluates exactly one coverage decision per allowlisted component and cannot add, rename, merge, or omit components silently.
- [x] 3.2 Update reasoning-output parsing and referential validation for nested parent/component identities, per-component candidate membership, and deterministic missing fallback behavior.
- [x] 3.3 Apply deterministic cross-component/cross-parent evidence deduplication and recalculate affected component coverage before parent aggregation.
- [x] 3.4 Implement and unit-test the pure parent aggregation function for all-strong, all-partial, all-weak, all-missing, mixed covered/missing, and other mixed statuses.
- [x] 3.5 Finalize Curated Evidence Packs with nested component coverage, deterministic parent evidence/factor/limitation summaries, component-aware recommended/missing views, and parent-weighted display scores.
- [x] 3.6 Advance curated pack content/prompt versions and update persistence schemas/readers to normalize legacy parent-only coverage and string warnings without rewriting immutable snapshots or changing old run identities.
- [x] 3.7 Update reasoner CLI JSON/verbose summaries and observability attributes with component outcomes, per-component selected counts, normalized warning codes, and deterministic parent results.

## 4. Component-Aware Resume Planning

- [x] 4.1 Evolve the compatible curated-evidence reader and frozen planning input to carry ordered parent/component coverage and evidence-to-component associations, including legacy singleton adaptation.
- [x] 4.2 Extend Resume Content Plan/domain schemas with target and uncovered component IDs while retaining parent requirement IDs for compatibility and source traceability.
- [x] 4.3 Update the planner prompt, structured-output schema, prompt version, and allowlists so covered components under a partial parent can be targeted without exposing missing siblings as covered.
- [x] 4.4 Extend deterministic planning validation to verify evidence-to-component membership, reject missing component targets, and reject wording that overstates a partially covered parent.
- [x] 4.5 Update resume-plan persistence/read compatibility, immutable identity inputs where required by the versioned contract, and CLI JSON/verbose component traceability.

## 5. Verification Fixtures and Tests

- [x] 5.1 Add parser and identity tests for Go/PostgreSQL, Terraform/AWS, Docker/Kubernetes, singleton conceptual phrases, coordinated verbs, unsupported conjuncts, provenance spans, and deterministic IDs.
- [x] 5.2 Add repository and migration tests for atomic parent/component writes, legacy no-component reads, stable source ordering, and rollback-safe immutable historical data.
- [x] 5.3 Add retrieval/candidate integration tests proving component isolation, exact-match retention, per-component limits, parent/component cardinality diagnostics, lossless JSON, and warning deduplication.
- [x] 5.4 Add reasoner schema/finalization tests proving unknown components fail, omitted components follow bounded fallback, mixed coverage preserves selected sibling evidence, parent aggregation is deterministic, and legacy curated packs remain readable.
- [x] 5.5 Add resume-planning unit and golden scenarios proving PostgreSQL can be used without Go, AWS without Terraform, Docker without Kubernetes, missing components remain uncovered, and parent wording is not overstated.
- [x] 5.6 Add end-to-end CLI fixtures that trace parent and component IDs from job ingestion through candidates, reasoning, Curated Evidence Pack output, and Resume Content Plan output.

## 6. Documentation and Release Verification

- [x] 6.1 Update jobs, retrieval, documents, architecture, ADR/roadmap, CLI, and migration documentation with the parent/component model, aggregation table, compatibility behavior, diagnostic units, and safety boundary.
- [x] 6.2 Run migration generation/checks, `npm run typecheck`, focused component/reasoning/planning tests, the full `npm test` suite, and `npm run build`; resolve all failures.
- [x] 6.3 Run strict OpenSpec validation and verify the implementation against every AEM010A-2 acceptance scenario before marking the change complete.
