## Context

Candidate preparation currently hydrates raw requirement-scoped retrieval subjects into canonical claims, associates unique claims, and exposes a `candidates` array to both the CLI and the LLM reasoner. The CLI default prints only a count, while `--verbose` prints stage counts and every discard record. Candidate order is claim ID order rather than ranking order. There is also a score-provenance defect: hydration is passed semantic and structured scores but not the retrieval item's calculated `finalScore`; when a hydrated claim is not found in `EvidencePack.items`, its score is reconstructed with a different formula.

Canonical hydration can validly expand one raw knowledge-asset retrieval subject into multiple claims. Consequently, a canonical-claim count such as `eligibleResultCount` can exceed the count of raw retrieval subjects; the current counter names and calculations do not make that unit change clear. The current requirement association loop also emits a duplicate discard for every repeated path to the same canonical claim even where later records add no new diagnostic value.

## Goals / Non-Goals

**Goals:**

- Keep every valid associated canonical candidate and all diagnostic detail in the machine-readable Candidate Evidence Pack.
- Bound only the evidence supplied to the reasoner with deterministic ranking rules, never qualitative relevance or coverage judgment.
- Make default candidates output brief, verbose output inspectable, and JSON lossless.
- Establish stage-count units that explain fan-out and score propagation unambiguously.
- Preserve exact structured matches regardless of a weak semantic score, score threshold, or ordinary selection limit.

**Non-Goals:**

- Changing retrieval's ranking formula, reconciliation eligibility, canonical evidence, or LLM coverage semantics.
- Treating a selection exclusion as a discarded/ineligible evidence claim.
- Introducing persistence for transient candidate diagnostics or recalibrating score values.

## Decisions

### Preserve one complete associated-candidate view and add a separate reasoner-selection view

Each requirement will keep `candidates` as the complete, deduplicated set of valid associated canonical claims. It will additionally expose an ordered `reasonerCandidateIds` (or equivalent non-duplicating selection reference) plus selection configuration/count diagnostics. The evidence-reasoning prompt resolves this ordered ID list against the complete candidates and sends only that deterministic subset to the LLM.

This makes `jobs candidates --json` lossless regardless of the selected limit and allows downstream machines to apply a different policy without re-retrieval. It also makes explicit that candidates excluded from model context are still valid evidence, not discard records. Alternative considered: replace `candidates` with the bounded set. That would conflate context control with evidence validity and violate the lossless JSON requirement.

### Make selection deterministic, score-ordered, and exact-structured-safe

Candidates will be sorted by `objectiveSignals.finalScore` descending, then `evidenceClaimId` ascending for stable ties. `--limit-per-requirement <number>` defaults to 10 and `--min-candidate-score <number>` is optional. Selection first retains every associated exact structured match (`structuredScore >= 1` under the existing retrieval contract); it then adds the remaining candidates whose final score meets the configured minimum, in final-score order, until the per-requirement limit is reached. Exact structured matches are never removed because of the semantic score, optional minimum score, or ordinary limit.

The limit applies only to non-exact candidates and is a model-context budget rather than a retrieval or association filter. A supplied minimum applies to final score only and excludes a non-exact candidate from the reasoner-selection view, not the complete candidate view. Alternative considered: apply the limit while retrieving or associating. That would make JSON incomplete and silently alter diagnostic counts.

### Propagate the retrieval final score through canonical fan-out without recomputation

Extend the canonical-reader handoff and hydrated-candidate contract to carry the raw retrieval result's already-calculated `finalScore`. Every canonical claim emitted from that raw subject inherits that final score together with its semantic score, structured score, retrieval strategies, and source provenance. If several raw results resolve to the same canonical claim, merge according to the existing retrieval identity merge rules and retain the best final score with the associated score/provenance tuple, rather than combining scores field-by-field from different origins.

This preserves the score that determined retrieval rank even when one asset fans out to several claims, and prevents the candidate pipeline from using a different formula. Alternative considered: recompute final score after hydration. Hydration has neither all ranking inputs nor the right ownership of retrieval ranking policy.

### Define counters by item type and derive them from explicit pipeline outcomes

Per-requirement summaries will use these fixed meanings:

- `raw`: number of retrieval subjects in `diagnostics.rawResults`.
- `hydrated`: number of canonical claim instances emitted by hydration before canonical-status eligibility filtering.
- `eligible`: number of hydrated canonical claim instances with an eligible status, before association deduplication.
- `associated`: number of unique eligible canonical claims in the complete `candidates` view.
- `selectedForReasoner`: number of associated candidates referenced by the reasoner-selection view.

CLI display will retain the requested concise label order `raw`, `eligible`, `hydrated`, `associated`, and `selected for reasoner`, while verbose output explains that the first count measures retrieval subjects and the latter counts measure canonical claims. `eligible` can therefore exceed `raw` when an asset subject hydrates to multiple eligible canonical claims; `hydrated` can exceed `raw` for the same reason. Counters are derived from typed terminal records/selection data instead of independently maintained arithmetic.

Duplicate diagnostics will be normalized by terminal semantic identity (requirement, stage, reason code, canonical claim or asset identity). A later duplicate only updates the retained record when it adds a retrieval strategy or better score provenance; otherwise it is not repeated. Alternative considered: preserve one record per traversal. That makes verbose output noisy without improving the explanation of the candidate's final outcome.

### Separate presentation modes from contract contents

`pke jobs candidates <job-id>` without flags will print one concise line per deterministic requirement with its text and the five stage counts, plus warnings. `--verbose` will additionally print retrieval intent, each ranked complete candidate with selection/exact-match status and score signals, selection exclusions, and normalized discard details. `--json` will serialize the full Candidate Evidence Pack, including all candidates, complete discard records, score provenance, selection references, and summary diagnostics; `--json` takes precedence over human formatting.

The candidates and reason commands will accept the same `--limit-per-requirement` and `--min-candidate-score` options so that an inspected pack can exactly match the reasoner input. The options are validated as a positive integer and a finite score. Alternative considered: make the candidates command only a display formatter. That would prevent operators from inspecting the exact bounded context provided to the reasoner.

## Risks / Trade-offs

- [Exact structured matches may exceed the configured limit] → Preserve them by contract and report the overage in selection diagnostics; correctness takes precedence over the soft context budget.
- [A score can be copied to several canonical claims] → Document that it represents the retrieval subject's rank, not a claim-truth probability, and test one-to-many propagation explicitly.
- [New pack fields change the hash and reasoner run identity] → Version the Candidate Evidence Pack and include deterministic selection configuration/references in the hashed content.
- [Verbose output can expose professional evidence details] → Keep candidate/discard detail out of default output; JSON and verbose remain explicit local-user requests.
- [Existing callers expect `candidates` to be the reasoner input] → Update the prompt builder and test fixtures together; retain `candidates` as the complete backward-readable view.

## Migration Plan

1. Add the versioned contract fields, score handoff, deterministic ordering/selection helper, and counter derivation with unit tests.
2. Route the evidence-reasoning prompt through selection references and add fan-out, exact-match, threshold, limit, and duplicate-diagnostic coverage.
3. Add CLI flags and the three output modes, then update CLI tests and documentation/help text.
4. Run type checking and the full test suite. Rollback is code-only: retain the existing stored canonical evidence and rerun reasoning with the prior package version if needed.

## Open Questions

- None. The initial default non-exact candidate limit is 10; exact structured matches deliberately remain exempt.
