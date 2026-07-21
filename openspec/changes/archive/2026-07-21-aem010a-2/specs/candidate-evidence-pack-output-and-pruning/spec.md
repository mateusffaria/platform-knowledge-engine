## MODIFIED Requirements

### Requirement: Candidate Evidence Pack remains lossless for machine consumers
The system SHALL retain every valid, uniquely associated canonical candidate in each atomic component's Candidate Evidence Pack `candidates` collection nested beneath its parent requirement. JSON output SHALL serialize the complete parent/component hierarchy, all available objective signals and provenance, all normalized discard diagnostics, and deterministic reasoner-selection metadata. A candidate excluded from the reasoner-selection view MUST NOT be represented as discarded or ineligible solely because it was not selected.

#### Scenario: Bounded reasoner context does not truncate JSON evidence
- **WHEN** a component has more associated valid candidates than its reasoner-selection limit
- **THEN** `pke jobs candidates --json` includes every associated candidate and identifies the bounded component selection separately

#### Scenario: Minimum score does not discard valid evidence
- **WHEN** a non-exact associated candidate is below an optional minimum candidate score
- **THEN** it remains in the component's complete candidates collection and JSON diagnostics identify it as excluded from reasoner selection rather than as a pipeline discard

### Requirement: Reasoner selection is deterministic and preserves exact structured matches
The system SHALL sort complete component candidates by final score descending and evidence-claim identity ascending for ties. It SHALL select evidence for the reasoner using a default `--limit-per-requirement` value of 10 applied to each atomic component and an optional `--min-candidate-score` final-score threshold. Candidate selection MUST be mechanical context control and MUST NOT perform qualitative relevance, coverage, or hiring reasoning. An associated exact structured match (`structuredScore >= 1`) MUST remain selected regardless of semantic score, optional minimum candidate score, or the ordinary non-exact component limit.

#### Scenario: Candidates are ranked by final score
- **WHEN** a component has associated candidates with different final scores
- **THEN** its complete candidates collection and non-exact selection order are descending by final score

#### Scenario: Exact structured match survives a low semantic score
- **WHEN** an associated exact structured candidate has a semantic score below other candidates or below an optional minimum candidate score
- **THEN** it remains in that component's reasoner-selection view

#### Scenario: Exact structured matches may exceed the ordinary limit
- **WHEN** a component has more exact structured matches than the configured per-requirement limit
- **THEN** all exact structured matches remain selected and component diagnostics report the selected count

## ADDED Requirements

### Requirement: Candidate pack warnings are normalized and deduplicated
The Candidate Evidence Pack SHALL represent warnings with stable code and message fields, normalize legacy warning strings at compatibility boundaries, deduplicate warnings by the exact code-and-message pair, and order them deterministically before hashing or output.

#### Scenario: Duplicate upstream warnings are merged
- **WHEN** multiple component retrievals emit the same warning code and message
- **THEN** the Candidate Evidence Pack contains one warning with that pair

#### Scenario: Same message has distinct codes
- **WHEN** two warnings have the same message but different codes
- **THEN** both warnings remain because they identify distinct conditions
