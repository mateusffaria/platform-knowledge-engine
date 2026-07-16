## 1. Diagnostic and requirement-scoped contracts

- [ ] 1.1 Add jobs domain contracts for requirement-scoped retrieval requests, candidate-pipeline stage counts, typed discard reasons, identity-bearing discard records, and Candidate Evidence Pack diagnostics.
- [ ] 1.2 Extend candidate evidence and retrieval-facing application contracts to preserve `requirementId`, `evidenceClaimId`, `knowledgeAssetId`, retrieval strategy, and score metadata from raw result through final association.
- [ ] 1.3 Add a jobs application port for requirement-scoped candidate preparation and a retrieval-owned `CanonicalEvidenceReader` port for canonical claim/asset hydration.
- [ ] 1.4 Add deterministic diagnostic builders that derive all stage counts from retained/discarded records and reject any raw result without a terminal outcome.

## 2. Retrieval, canonical hydration, and eligibility repair

- [ ] 2.1 Remove the hybrid-search gate that suppresses semantic retrieval when explicit structured filters produce no matches; preserve structured candidate constraints only when structured candidates exist.
- [ ] 2.2 Extend hybrid retrieval result contracts to report raw structured/semantic results, eligibility decisions, score-gate outcomes, and result identities for requirement-scoped callers.
- [ ] 2.3 Implement the production Canonical Evidence Reader for direct evidence-claim hydration and deterministic knowledge-asset-to-eligible-claim resolution, including source/asset identity consistency checks.
- [ ] 2.4 Add a legacy/evolved claim compatibility mapper and emit explicit diagnostics for unsupported legacy records rather than silently dropping them.
- [ ] 2.5 Centralize eligibility on the reconciliation application contract, retain `confirmed` and `single_source`, explicitly discard unavailable/ineligible canonical statuses, and remove undocumented intermediate score gates.
- [ ] 2.6 Add focused retrieval and hydration tests for empty structured fallback to semantic, both retrieval subject types, status eligibility, identity mismatches, legacy diagnostics, and explicit score-threshold discards.

## 3. Candidate Evidence Pack preparation

- [ ] 3.1 Implement the requirement-scoped candidate-preparation use case: derive one request per deterministic job requirement, execute retrieval, hydrate canonical evidence, associate retained claims only to their originating requirement, and attach diagnostics.
- [ ] 3.2 Replace global Evidence Pack cloning in Candidate Evidence Pack construction with requirement-scoped associations while retaining immutable canonical evidence/provenance and deterministic pack hashing.
- [ ] 3.3 Update `ReasonJobEvidence` to consume the prepared Candidate Evidence Pack and preserve its diagnostics without granting the reasoner retrieval/database access.
- [ ] 3.4 Add tests that prove retained low-scoring valid candidates, explicit empty results, and every discarded raw/hydrated result have correct requirement IDs and terminal diagnostics.

## 4. Jobs CLI diagnostics

- [ ] 4.1 Add `pke jobs candidates <job-id>` with JSON and verbose output for the complete Candidate Evidence Pack and per-requirement pipeline diagnostics.
- [ ] 4.2 Route `pke jobs retrieve <job-id> --verbose` through requirement-scoped preparation and render intent, raw/eligible/hydrated/associated counts, claim/asset identities, and discard reasons.
- [ ] 4.3 Keep concise retrieval output stable while adding actionable no-evidence and legacy/hydration diagnostic summaries.
- [ ] 4.4 Add CLI tests for candidates JSON/verbose, retrieve verbose diagnostics, unknown-job/configuration errors, and lifecycle-safe service closing.

## 5. End-to-end verification and documentation

- [ ] 5.1 Add canonical knowledge and job fixtures covering Go, PostgreSQL, AWS, technical leadership, Pismo/financial systems, and intentionally absent Kubernetes evidence.
- [ ] 5.2 Add end-to-end tests from each fixture requirement through retrieval intent, semantic/structured retrieval, canonical hydration, eligibility, Candidate Evidence Pack diagnostics, and bounded reasoning input.
- [ ] 5.3 Verify Go, PostgreSQL, AWS, technical leadership, and Pismo requirements receive traceable candidates; verify Kubernetes stays explicit missing with diagnostic evidence.
- [ ] 5.4 Update jobs/retrieval documentation and architecture guidance with candidate pipeline stages, diagnostic output, canonical hydration ownership, and the rule that reindexing is not a hydration fix.
- [ ] 5.5 Run `npm run typecheck` and `npm test`, resolve failures, and validate the OpenSpec change before implementation handoff.
