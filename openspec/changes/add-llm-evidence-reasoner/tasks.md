## 1. Domain contracts and deterministic candidate preparation

- [x] 1.1 Add jobs domain models for `CandidateEvidencePack`, requirement-scoped canonical candidate evidence, objective signals, `CuratedEvidencePack`, `RequirementCoverage`, `EvidenceSelection`, `EvidenceRejection`, coverage status, exaggeration risk, and rejection reason enums.
- [x] 1.2 Define the candidate-pack version and deterministic hash calculation over canonical, claim-addressable requirement groups, selected analysis identity, objective signals, and upstream warnings.
- [x] 1.3 Implement candidate-pack construction that consumes the existing job/retrieval boundary, groups eligible canonical evidence claims by job requirement, preserves trust/provenance/objective signals, and warns when asset-only retrieval results are excluded.
- [x] 1.4 Add deterministic helpers for missing requirement coverage, qualitative coverage validation/downgrade, optional importance-weighted display scoring, and cross-requirement selection deduplication with stable tie-breakers.
- [x] 1.5 Add unit tests for candidate-pack hashing/grouping, asset-only exclusion, missing coverage, display-score determinism, and complementary versus redundant cross-requirement decisions.

## 2. Bounded reasoner contracts and structured output

- [x] 2.1 Add `EvidenceReasoner`, curated-evidence repository, candidate-pack builder, and evidence-reasoning observability ports; export them from the jobs application boundary.
- [x] 2.2 Add a versioned, application-owned evidence-reasoning system/user prompt that supplies only requirement-scoped candidate evidence and explicitly prohibits retrieval, evidence creation, trust changes, canonical rewrites, objective-signal rewrites, and unsupported interpretation.
- [x] 2.3 Define Zod schemas for the provider's referential reasoning response and validate coverage statuses, selection/rejection reasons, exaggeration risks, bounded explanations, and complementary references.
- [x] 2.4 Implement post-schema validation that rejects unknown requirement/claim IDs, cross-group references, duplicate or contradictory decisions, missing-coverage selections, unsupported strong skill-only coverage, and attempts to supply canonical evidence fields.
- [x] 2.5 Implement `LlmEvidenceReasoner` using only the supplied Candidate Evidence Pack, `LlmProvider`, versioned prompt, schema parsing, and safe trace events; rebuild final selected/rejected evidence from canonical input rather than provider copies.
- [x] 2.6 Add mocked-provider tests for complementary selection, irrelevant/redundant rejection, explicit limitations, unknown IDs, malformed JSON, invalid enums, contradictory output, missing coverage, objective-signal preservation, and safe failure without pack mutation.

## 3. Reasoning orchestration and persistence

- [x] 3.1 Add `ReasonJobEvidence` use case to load the job context, obtain the bounded Candidate Evidence Pack, resolve provider/model identity, reuse an equivalent successful curated run, invoke the reasoner only when needed, deterministically finalize it, and persist the result.
- [x] 3.2 Add the additive curated-evidence/reasoning-run Drizzle schema, migration, job/analysis foreign keys, candidate-pack version/hash, provider/model/prompt metadata, run identity, serialized finalized result, creation timestamp, history index, and uniqueness constraint.
- [x] 3.3 Implement the Drizzle curated-evidence repository with strict serialization/deserialization validation, run-identity lookup, immutable save behavior, and unique-conflict reload behavior.
- [x] 3.4 Add a Langfuse-backed/no-op-safe evidence-reasoning observability adapter that records safe identifiers, candidate-pack hash/version, provider/model, prompt version, provider completion/failure, validation/finalization outcome, and always flushes.
- [x] 3.5 Add use-case and repository tests for run reuse, changed pack/analysis/provider/model/prompt identities, persistence round trips, concurrent uniqueness conflicts, provider failure, validation failure, and trace flushing.

## 4. Composition and CLI

- [x] 4.1 Compose the candidate-pack builder, `LlmEvidenceReasoner`, curated-evidence repository, provider factory, and evidence-reasoning observability adapter in production jobs services without changing existing ingest, analyze, or retrieve behavior.
- [x] 4.2 Extend the jobs service interfaces and register `pke jobs reason <job-id>` with `--model`, `--json`, and `--verbose` validation and lifecycle-safe resource closing.
- [x] 4.3 Implement concise and verbose Curated Evidence Pack rendering: overall coverage, requirement statuses, selected evidence, warnings/limitations, and, in verbose mode, run metadata, canonical IDs/provenance, selections, rejections, strength factors, and display-score semantics.
- [x] 4.4 Add CLI tests for default, JSON, verbose, model override, missing configuration/job errors, and proof that rendering does not own reasoning, deduplication, or retrieval behavior.

## 5. Documentation and verification

- [x] 5.1 Update the jobs module README and root README with the `jobs reason` workflow, configuration/model override behavior, Candidate/Curated Evidence Pack fields, and qualitative-coverage limitations.
- [x] 5.2 Update architecture and roadmap documentation to place candidate preparation/retrieval, bounded jobs reasoning, persistence, and observability in their correct module boundaries.
- [x] 5.3 Add an ADR documenting referential LLM output, deterministic post-processing, immutable run provenance, and the rule that curated coverage is not hiring-fit proof.
- [x] 5.4 Extend architecture-boundary tests to ensure evidence-reasoning application code has no database, pgvector, retrieval-infrastructure, repository, or provider-SDK imports.
- [x] 5.5 Run `npm run typecheck` and `npm test`, then resolve all failures before marking the change ready for implementation.
