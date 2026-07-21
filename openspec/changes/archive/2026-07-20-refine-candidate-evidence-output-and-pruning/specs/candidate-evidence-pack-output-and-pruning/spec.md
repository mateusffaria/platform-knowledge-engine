## ADDED Requirements

### Requirement: Candidate Evidence Pack remains lossless for machine consumers
The system SHALL retain every valid, uniquely associated canonical candidate in each requirement's Candidate Evidence Pack `candidates` collection. JSON output SHALL serialize that complete collection, all available objective signals and provenance, all normalized discard diagnostics, and the deterministic reasoner-selection metadata. A candidate excluded from the reasoner-selection view MUST NOT be represented as discarded or ineligible solely because it was not selected.

#### Scenario: Bounded reasoner context does not truncate JSON evidence
- **WHEN** a requirement has more associated valid candidates than its reasoner-selection limit
- **THEN** `pke jobs candidates --json` includes every associated candidate and identifies the bounded selection separately

#### Scenario: Minimum score does not discard valid evidence
- **WHEN** a non-exact associated candidate is below an optional minimum candidate score
- **THEN** it remains in the complete candidates collection and JSON diagnostics identify it as excluded from reasoner selection rather than as a pipeline discard

### Requirement: Reasoner selection is deterministic and preserves exact structured matches
The system SHALL sort complete candidates by final score descending and evidence-claim identity ascending for ties. It SHALL select evidence for the reasoner using a default `--limit-per-requirement` value of 10 and an optional `--min-candidate-score` final-score threshold. Candidate selection MUST be mechanical context control and MUST NOT perform qualitative relevance, coverage, or hiring reasoning. An associated exact structured match (`structuredScore >= 1`) MUST remain selected regardless of semantic score, optional minimum candidate score, or the ordinary non-exact candidate limit.

#### Scenario: Candidates are ranked by final score
- **WHEN** a requirement has associated candidates with different final scores
- **THEN** its complete candidates collection and non-exact selection order are descending by final score

#### Scenario: Exact structured match survives a low semantic score
- **WHEN** an associated exact structured candidate has a semantic score below other candidates or below an optional minimum candidate score
- **THEN** it remains in the reasoner-selection view

#### Scenario: Exact structured matches may exceed the ordinary limit
- **WHEN** a requirement has more exact structured matches than the configured per-requirement limit
- **THEN** all exact structured matches remain selected and diagnostics report the selected count

### Requirement: Candidate score provenance survives canonical hydration fan-out
The system SHALL pass the retrieval item's calculated final score into canonical hydration and SHALL propagate that score, its semantic score, its structured score, and retrieval provenance to each canonical claim produced from the retrieval subject. The candidate preparation layer MUST NOT recompute final score with a different formula. When several raw results resolve to the same canonical claim, the system SHALL retain deterministic best score/provenance data for the single associated candidate.

#### Scenario: One retrieval subject expands to several claims
- **WHEN** one raw knowledge-asset retrieval result hydrates into multiple eligible canonical claims
- **THEN** each resulting candidate preserves that raw result's final score and retrieval score signals

#### Scenario: Hydrated claim is absent from rendered retrieval items
- **WHEN** a canonical claim is produced from retrieval diagnostics but does not appear in `EvidencePack.items`
- **THEN** its final score equals the score supplied by the raw retrieval result and is not reconstructed by candidate preparation

### Requirement: Per-requirement diagnostics use consistent pipeline-stage units
The system SHALL provide per-requirement summary diagnostics for `raw`, `eligible`, `hydrated`, `associated`, and `selectedForReasoner`. `raw` SHALL count retrieval subjects; `hydrated` SHALL count canonical claims emitted before canonical-status eligibility; `eligible` SHALL count eligible canonical claims before association deduplication; `associated` SHALL count unique valid candidates; and `selectedForReasoner` SHALL count selected candidate references. Verbose and JSON output SHALL describe these units sufficiently to explain why eligible or hydrated counts can exceed raw counts.

#### Scenario: Asset fan-out makes eligible exceed raw
- **WHEN** one raw retrieval subject hydrates into two eligible canonical claims
- **THEN** diagnostics report raw as one and eligible as two without treating the difference as an error

#### Scenario: Ineligible hydrated claim is counted consistently
- **WHEN** a hydrated canonical claim fails status eligibility
- **THEN** it contributes to hydrated, does not contribute to eligible or associated, and has an eligibility discard diagnostic

### Requirement: Candidate diagnostics avoid redundant discard noise
The system SHALL retain diagnostics for every materially distinct terminal discard outcome and SHALL normalize repeated discard records that have the same requirement, stage, reason code, and candidate or asset identity. A duplicate record MAY be retained or updated only when it adds distinct retrieval strategy or score provenance.

#### Scenario: Repeated association path adds no new information
- **WHEN** multiple retrieval paths produce the same already-associated canonical claim with identical diagnostic provenance
- **THEN** verbose and JSON diagnostics contain one duplicate-association discard record for that outcome

#### Scenario: Duplicate path adds provenance
- **WHEN** a repeated discard path contributes a new retrieval strategy or better score provenance
- **THEN** the normalized diagnostic preserves the additional provenance without duplicating the terminal outcome

### Requirement: Jobs candidates CLI has concise, verbose, and JSON modes
The system SHALL add `--limit-per-requirement <number>` and `--min-candidate-score <number>` to `pke jobs candidates <job-id>` and `pke jobs reason <job-id>`. The default candidates output SHALL show one concise summary per deterministic requirement with raw, eligible, hydrated, associated, and selected-for-reasoner counts. `--verbose` SHALL additionally show retrieval intent, ranked candidates, selection decisions, and normalized discard detail. `--json` SHALL output the full lossless Candidate Evidence Pack and SHALL take precedence over human-oriented formatting.

#### Scenario: Default output is concise
- **WHEN** a user runs `pke jobs candidates <job-id>` without output flags
- **THEN** the output contains per-requirement summary counts but no candidate provenance or discard-record detail

#### Scenario: Verbose output exposes diagnostic detail
- **WHEN** a user runs `pke jobs candidates <job-id> --verbose`
- **THEN** the output includes selection decisions and normalized discard details for each requirement

#### Scenario: Reasoning uses inspected selection controls
- **WHEN** a user runs `pke jobs reason <job-id>` with candidate selection options
- **THEN** the reasoner receives the same deterministic selected candidate IDs that `pke jobs candidates` would report with those options
