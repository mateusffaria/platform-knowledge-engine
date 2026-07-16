## Context

Jobs currently builds one aggregate `JobRetrievalIntent`, runs hybrid retrieval once, and passes its final `EvidencePack` to `buildCandidateEvidencePack`. The candidate builder clones every final claim-addressable item to every deterministic requirement and only records asset-only drops. It has no requirement identity in its retrieval input/output and cannot distinguish no retrieval match from a structured-search, semantic-search, eligibility, hydration, score, or association loss.

The current hybrid path contains a likely silent-loss condition: semantic search is skipped when a plan has explicit filters and structured search returns zero results. It also parses semantic embedding text into a partial candidate and treats an absent claim status as eligible. These behaviors make a missing exact predicate or a legacy embedding representation capable of removing otherwise relevant semantic evidence without a traceable explanation.

## Goals / Non-Goals

**Goals:**

- Build Candidate Evidence Packs requirement by requirement and preserve requirement/evidence/asset identities throughout the pipeline.
- Produce machine-readable diagnostics for intent, raw retrieval, eligibility, canonical hydration, association, scoring, and every discard.
- Ensure confirmed and single-source canonical claims survive either structured or semantic discovery when they are relevant to a requirement.
- Use a canonical evidence reader to hydrate both evidence-claim and knowledge-asset retrieval subjects, with explicit legacy compatibility diagnostics.
- Provide `jobs retrieve --verbose` and `jobs candidates` observability without giving the Evidence Reasoner retrieval or database access.

**Non-Goals:**

- Changing reconciliation policy, admitting ineligible claims, inventing career evidence, or making LLM reasoning perform retrieval.
- Reindexing as a correction for hydration or association defects.
- New embedding providers, score calibration/benchmarking, resumes, or document generation.

## Decisions

### Make candidate preparation a requirement-scoped orchestration use case

Introduce a jobs application use case that expands the canonical deterministic requirements into requirement-scoped retrieval requests. Each request carries `requirementId`, original requirement text, importance, deterministic filters, semantic text, and a diagnostic context; it is passed through an explicit retrieval-facing application port rather than by importing retrieval infrastructure. The use case receives raw results and diagnostics, canonicalizes/hydrates them, associates them only to the originating requirement, then builds the Candidate Evidence Pack.

Aggregate job retrieval remains available for user-facing convenience, but `jobs candidates` and `jobs reason` use the requirement-scoped preparation result. This replaces cloning one aggregate result list into every requirement group.

Alternative considered: infer association after a single aggregate search. That cannot report which requirement lost a candidate and gives a weak global result no reliable source requirement identity.

### Model diagnostics as first-class, append-only pipeline records

Add `RequirementCandidatePipelineDiagnostics` to the Candidate Evidence Pack. It records the requirement retrieval intent; raw structured/semantic result counts; eligible result count; canonical hydration count; associated count; and ordered `DiscardedCandidateResult` records. Every record includes stage, reason code, human explanation, and available `evidenceClaimId`, `knowledgeAssetId`, retrieval strategy, and score metadata.

The only permitted terminal outcomes for every raw result are retained/associated, an explicit discard, or an actionable failure. Counters are derived from records, not maintained independently. A `jobs candidates --json` response returns the full pack and diagnostics; verbose human output summarizes counts and prints discarded identities/reasons. `jobs retrieve --verbose` exposes its intent, strategies, result identities, eligibility outcomes, and final discard information.

Alternative considered: log diagnostics only. Logs cannot be reliably correlated with a command, inspected in JSON, or consumed by tests and downstream tooling.

### Always execute selected semantic retrieval and hydrate canonical evidence afterward

If the query planner selects semantic retrieval, hybrid search executes semantic search even when structured filters return zero candidates. Structured matches may constrain semantic candidates when they exist; an empty structured result must fall back to the normal semantic corpus rather than skip semantic search. Ranking may make weak candidates lower priority, but semantic discovery must not require an exact structured predicate.

Introduce a retrieval-owned `CanonicalEvidenceReader` port that receives retrieval result identities and returns canonical, claim-addressable evidence. It hydrates an evidence-claim subject directly and resolves a knowledge-asset subject to its eligible canonical claims. Hydration validates identity consistency between the retrieval result and canonical record, preserves claim/asset/source identities, and returns explicit unsupported-legacy diagnostics rather than silently dropping records. A compatibility mapper aligns legacy and evolved claim representations before eligibility/ranking.

Alternative considered: continue parsing embedded text as the canonical record. Embedding text is a retrieval projection, may be legacy-shaped, and cannot establish eligibility or complete provenance by itself.

### Centralize eligibility and documented score decisions

Candidate eligibility is evaluated only from the canonical claim status via the reconciliation application contract. `confirmed` and `single_source` are eligible; missing, rejected, superseded, and needs-review statuses are explicit discard outcomes. Retrieval and hydration must not treat an absent parsed embedding status as implicitly eligible.

The pipeline exposes the retrieval ranking score and any caller-provided minimum final score as the only score gates. Remove hidden/undocumented structured or hydration thresholds; a low but valid canonical candidate stays associated with its requirement and can be ranked lower instead of disappearing.

Alternative considered: retain multiple local thresholds. That obscures why a claim was removed and produces different behavior between structured and semantic paths.

## Risks / Trade-offs

- [Per-requirement retrieval increases calls] → Bound candidates per requirement, reuse request-level metadata lookup/cache, and make diagnostics identify the cost explicitly.
- [Asset subjects resolve to multiple claims] → Preserve the asset result identity, return each eligible claim with a deterministic order, and emit a diagnostic for every unresolved/unsupported claim.
- [Legacy records cannot be normalized safely] → Mark them with a typed legacy-compatibility discard instead of inventing fields or silently excluding them.
- [Verbose diagnostics expose professional data] → Default to counts/reasons; include claim/source detail only in verbose or JSON output already authorized by the local CLI user.
- [Changing semantic fallback increases noisy candidates] → Keep existing ranking and final minimum-score behavior; association retains valid low-ranked candidates but does not elevate them to strong coverage.

## Migration Plan

1. Add diagnostic and requirement-scoped contracts behind jobs/retrieval ports, plus fixtures that reproduce the current missing-evidence behavior.
2. Implement semantic fallback, canonical reader hydration, centralized eligibility, and explicit discard outcomes with integration tests before switching CLI output.
3. Route `jobs candidates`, `jobs retrieve`, and `jobs reason` through the requirement-scoped preparation use case; retain the existing aggregate retrieve command behavior where no job context is supplied.
4. Update documentation and run the full suite. Rollback restores the prior candidate preparation wiring; diagnostics are additive and do not mutate canonical claims, embeddings, or reconciliation status.

## Open Questions

- None. Initial diagnostics will be returned on demand with the Candidate Evidence Pack rather than persisted; persisted run metadata continues to retain the finalized pack hash and reasoning provenance.
