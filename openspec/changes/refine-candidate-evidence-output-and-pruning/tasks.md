## 1. Candidate-pack contract and score provenance

- [x] 1.1 Version the Candidate Evidence Pack contract and add lossless reasoner-selection references/configuration plus the `selectedForReasoner` summary count.
- [x] 1.2 Extend canonical-evidence reader input/output plumbing to carry the retrieval item's calculated final score and associated score/provenance tuple through hydration.
- [x] 1.3 Update candidate preparation to preserve final-score provenance during one-to-many hydration and deterministic duplicate association merging without score recomputation.
- [x] 1.4 Derive raw, hydrated, eligible, associated, and selected-for-reasoner diagnostics from explicit pipeline outcomes; document their item units in contract comments.

## 2. Deterministic reasoner selection and diagnostic normalization

- [x] 2.1 Implement a pure candidate-selection helper that ranks by final score descending with stable claim-ID ties and applies the default non-exact limit of 10.
- [x] 2.2 Apply optional minimum final-score selection filtering without removing associated candidates from the complete Candidate Evidence Pack.
- [x] 2.3 Detect exact structured matches from the retrieval contract and retain them for the reasoner regardless of semantic score, minimum score, or ordinary limit.
- [x] 2.4 Normalize duplicate discard outcomes by requirement, stage, reason, and canonical identity while merging only materially new strategy or score provenance.
- [x] 2.5 Update the evidence-reasoning prompt and validation path to resolve and supply only deterministic reasoner-selected candidates while preserving complete candidate evidence for machine consumers.

## 3. CLI controls and presentation

- [x] 3.1 Add validated `--limit-per-requirement <number>` and `--min-candidate-score <number>` options to jobs candidates and jobs reason, and pass the same selection configuration to candidate preparation.
- [x] 3.2 Render concise default candidates output as per-requirement raw, eligible, hydrated, associated, and selected-for-reasoner summaries without candidate or discard details.
- [x] 3.3 Extend verbose candidates output with counter-unit explanation, ranked candidate selection status, score signals, selection exclusions, and normalized discard detail.
- [x] 3.4 Keep JSON output lossless and ensure it takes precedence over human-oriented output formatting.

## 4. Verification and documentation

- [x] 4.1 Add candidate-pipeline tests for canonical asset fan-out, counter units, exact final-score propagation, and deterministic duplicate score/provenance merging.
- [x] 4.2 Add selection tests for descending order, stable ties, default/overridden limits, optional minimum score, and exact structured-match exemptions including limit overage.
- [x] 4.3 Add CLI tests for concise default output, verbose-only candidate/discard detail, lossless JSON, option validation, and parity between candidates inspection and reasoner input.
- [x] 4.4 Update jobs CLI help/module documentation to explain selection as non-qualitative context control and explain counter fan-out semantics.
- [x] 4.5 Run `npm run typecheck` and `npm test`.
