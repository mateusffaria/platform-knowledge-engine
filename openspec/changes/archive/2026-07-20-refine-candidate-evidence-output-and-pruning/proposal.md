## Why

`pke jobs candidates` currently gives a human either only a count or the entire diagnostic payload, while its counter names obscure that a single retrieval result can expand into several canonical claims. The reasoner also has no explicit, observable boundary between all valid associated evidence and the smaller ranked set sent to the model, making low-value noise difficult to control without risking loss of exact structured matches.

## What Changes

- Define a lossless Candidate Evidence Pack contract that retains every valid, associated canonical candidate for machine consumers and JSON output.
- Add a deterministic, non-qualitative reasoner-selection stage with a default per-requirement limit, optional minimum final-score threshold, descending final-score order, and an exemption for exact structured matches.
- Make the jobs candidates CLI concise by default, show full candidate and discard detail only with `--json` or `--verbose`, and add `--limit-per-requirement` and `--min-candidate-score` controls.
- Replace ambiguous counter semantics with stage-consistent per-requirement summaries: raw retrieval results, eligible canonical claims, hydrated canonical claims, associated candidates, and candidates selected for the reasoner.
- Preserve score provenance when retrieval subjects expand into canonical claims and collapse duplicate discard records that convey the same terminal diagnostic outcome.

## Capabilities

### New Capabilities

- `candidate-evidence-pack-output-and-pruning`: Lossless candidate-pack representation, deterministic reasoner selection, coherent pipeline diagnostics, and the jobs candidates CLI presentation and controls.

### Modified Capabilities

- None.

## Impact

- Affects jobs domain candidate-pack contracts, candidate preparation, evidence-reasoning prompt input, and `pke jobs candidates` / `pke jobs reason` CLI options and renderers.
- Adds focused candidate-pipeline and CLI tests for stage counts, score propagation, ranking, structured-match preservation, selection limits, and output visibility.
- Does not change canonical evidence, reconciliation eligibility policy, retrieval ranking formula, or JSON availability of valid evidence.
