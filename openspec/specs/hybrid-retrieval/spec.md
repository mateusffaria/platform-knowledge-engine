# Hybrid Retrieval Specification

## Purpose
Defines the required behavior for the `hybrid-retrieval` capability.

## Requirements

### Requirement: Query planner selects retrieval strategies deterministically
The system SHALL plan each retrieval query using deterministic, rule-based logic that selects structured retrieval, semantic retrieval, or both without using an LLM.

#### Scenario: Exact professional terms trigger structured retrieval
- **WHEN** the user retrieves evidence for a query containing exact skill, company, role, technology, or date-like terms
- **THEN** the planner selects structured retrieval and records `structured` in the Evidence Pack strategies

#### Scenario: Conceptual queries trigger semantic retrieval
- **WHEN** the user retrieves evidence for a natural-language or conceptual query without exact structured terms
- **THEN** the planner selects semantic retrieval and records `semantic` in the Evidence Pack strategies

#### Scenario: Mixed queries use both retrieval strategies
- **WHEN** the user retrieves evidence for a query containing both exact structured terms and natural-language intent
- **THEN** the planner selects both structured and semantic retrieval in a deterministic order

#### Scenario: Empty query is rejected
- **WHEN** the retrieval use case receives an empty or whitespace-only query
- **THEN** it rejects the request with an actionable validation error before calling any retrieval port

### Requirement: Structured knowledge search is accessed through a retrieval port
The system SHALL define and use a `StructuredKnowledgeSearch` application port for exact structured matches against eligible professional knowledge.

#### Scenario: Structured retrieval uses an application contract
- **WHEN** hybrid retrieval needs exact structured matches
- **THEN** the retrieval use case calls the `StructuredKnowledgeSearch` port rather than importing knowledge repositories, reconciliation repositories, Drizzle schema, or database adapters directly

#### Scenario: Structured result preserves evidence metadata
- **WHEN** structured retrieval returns a matching claim
- **THEN** the candidate includes knowledge asset identity, evidence claim identity when available, claim type, claim text, claim status, confidence score, structured match score, source references, and source excerpts

#### Scenario: Structured filters are passed to the port
- **WHEN** the user supplies retrieval filters for claim status or subject type
- **THEN** the structured retrieval request includes those filters in the port input

### Requirement: Hybrid search combines structured and semantic candidates
The system SHALL provide a `HybridSearch` use case that combines structured retrieval candidates and semantic vector retrieval candidates into one Evidence Pack.

#### Scenario: Structured-only matches are returned
- **WHEN** the planner selects structured retrieval and semantic retrieval is not selected
- **THEN** the Evidence Pack contains ranked structured evidence items with structured scores and without semantic scores

#### Scenario: Semantic-only matches are returned
- **WHEN** the planner selects semantic retrieval and structured retrieval is not selected
- **THEN** the Evidence Pack contains ranked semantic evidence items with semantic similarity scores when available

#### Scenario: Hybrid matches preserve both score types
- **WHEN** the same evidence is returned by structured retrieval and semantic retrieval
- **THEN** the merged Evidence Item preserves both the structured match score and the semantic similarity score

#### Scenario: Retrieval limit is applied after merge and ranking
- **WHEN** the user supplies `--limit <number>`
- **THEN** the Evidence Pack includes no more than that number of ranked Evidence Items after deduplication and ranking are complete

#### Scenario: Minimum score filters final ranked evidence
- **WHEN** the user supplies `--min-score <number>`
- **THEN** the Evidence Pack excludes Evidence Items whose final ranking score is lower than the requested minimum

### Requirement: Evidence Pack is traceable and complete
The system SHALL return an Evidence Pack containing the original query, selected strategies, ranked evidence, generation timestamp, and warnings or unresolved limitations.

#### Scenario: Evidence Pack includes query-level metadata
- **WHEN** `HybridSearch` returns an Evidence Pack
- **THEN** the pack includes the original trimmed query, retrieval strategies used, retrieval timestamp, ranked Evidence Items, and warnings

#### Scenario: Evidence Item includes trust and score metadata
- **WHEN** an Evidence Item is included in a pack
- **THEN** it includes claim status, confidence score, semantic similarity score when available, structured match score when available, final ranking score, and source references

#### Scenario: Evidence Item includes source excerpts
- **WHEN** an Evidence Item references a source
- **THEN** the item includes the source reference identity and excerpt needed to trace the evidence back to the original professional source

#### Scenario: No relevant evidence returns an empty pack with warning
- **WHEN** no candidate passes retrieval and scoring filters
- **THEN** the Evidence Pack contains an empty item list and a warning that no relevant eligible evidence was found

### Requirement: Duplicate evidence is merged deterministically
The system SHALL deduplicate retrieval candidates before returning Evidence Items.

#### Scenario: Duplicate evidence claims appear once
- **WHEN** structured and semantic retrieval return candidates with the same evidence claim identity
- **THEN** the Evidence Pack contains one Evidence Item for that claim

#### Scenario: Asset-only duplicates appear once
- **WHEN** candidates do not have evidence claim identity but share the same knowledge asset identity
- **THEN** the Evidence Pack contains one Evidence Item for that knowledge asset fallback identity

#### Scenario: Deduplication preserves strongest metadata
- **WHEN** duplicate candidates are merged
- **THEN** the resulting Evidence Item preserves all available source references and the highest available structured, semantic, confidence, and final ranking inputs before final score calculation

### Requirement: Ranking is deterministic and configurable
The system SHALL rank Evidence Items using deterministic scoring rules with configurable weights.

#### Scenario: Confirmed claims outrank equivalent single-source claims
- **WHEN** two Evidence Items are otherwise equivalent but one has claim status `confirmed` and the other has claim status `single_source`
- **THEN** the confirmed Evidence Item ranks above the single-source Evidence Item

#### Scenario: Exact structured matches receive a boost
- **WHEN** an Evidence Item has an exact structured match score
- **THEN** ranking applies the configured structured-match boost when calculating final ranking score

#### Scenario: Semantic similarity contributes to ranking
- **WHEN** an Evidence Item has a semantic similarity score
- **THEN** ranking applies the configured semantic similarity weight when calculating final ranking score

#### Scenario: Stable tie-breakers produce deterministic ordering
- **WHEN** two Evidence Items have the same final ranking score
- **THEN** the ranking policy orders them deterministically using stable identities and does not depend on retrieval adapter return order

#### Scenario: Final score is not presented as truth probability
- **WHEN** the CLI or documentation describes `finalScore`
- **THEN** it identifies the value as a retrieval ranking score and MUST NOT present it as an objective probability of truth

### Requirement: Ineligible claims are excluded from Evidence Packs
The system SHALL exclude claims with non-trusted statuses from hybrid retrieval output.

#### Scenario: Confirmed and single-source claims are eligible
- **WHEN** retrieved candidates have claim status `confirmed` or `single_source`
- **THEN** they are eligible to appear in the Evidence Pack subject to query, filter, and ranking rules

#### Scenario: Rejected claims are excluded
- **WHEN** retrieved candidates have claim status `rejected`
- **THEN** they MUST NOT appear in the Evidence Pack

#### Scenario: Superseded claims are excluded
- **WHEN** retrieved candidates have claim status `superseded`
- **THEN** they MUST NOT appear in the Evidence Pack

#### Scenario: Needs-review claims are excluded
- **WHEN** retrieved candidates have claim status `needs_review`
- **THEN** they MUST NOT appear in the Evidence Pack

#### Scenario: Claim status filter cannot opt into ineligible claims
- **WHEN** the user supplies a claim status filter for `needs_review`, `rejected`, or `superseded`
- **THEN** the retrieval command rejects the filter or returns no trusted evidence rather than including ineligible claims

### Requirement: Retrieve CLI returns Evidence Packs
The system SHALL expose hybrid retrieval through `pke retrieve "<query>"` while preserving existing semantic search behavior.

#### Scenario: Retrieve command prints ranked evidence
- **WHEN** the user runs `pke retrieve "<query>"`
- **THEN** the command executes `HybridSearch` and prints ranked Evidence Items with concise claim, score, status, and source context

#### Scenario: Retrieve command supports JSON output
- **WHEN** the user runs `pke retrieve "<query>" --json`
- **THEN** the command prints the complete Evidence Pack as machine-readable JSON

#### Scenario: Retrieve command supports verbose output
- **WHEN** the user runs `pke retrieve "<query>" --verbose`
- **THEN** the command includes identifiers, strategy details, score components, and source excerpts for each Evidence Item

#### Scenario: Retrieve command supports filters and thresholds
- **WHEN** the user runs `pke retrieve "<query>"` with `--limit`, `--min-score`, `--claim-status`, or `--subject-type`
- **THEN** the command validates those options and passes them to the hybrid retrieval use case

#### Scenario: Existing semantic search remains functional
- **WHEN** the user runs the existing `pke search "<query>"` command
- **THEN** the command keeps its semantic-search behavior and does not require hybrid retrieval-specific structured search configuration

### Requirement: Hybrid retrieval respects module boundaries
The system SHALL keep retrieval use cases independent from knowledge, reconciliation, database, provider, and CLI infrastructure.

#### Scenario: Retrieval application depends on ports
- **WHEN** imports under `src/modules/retrieval/application` are inspected
- **THEN** hybrid retrieval use cases depend on retrieval domain types, retrieval application ports, and allowed shared application utilities rather than infrastructure adapters

#### Scenario: Retrieval does not own reconciliation policy
- **WHEN** a claim's status determines trusted evidence eligibility
- **THEN** retrieval applies the eligibility contract exposed to it and does not implement claim reconciliation or truth resolution workflows

#### Scenario: CLI remains a thin adapter
- **WHEN** retrieval CLI handlers are inspected
- **THEN** they parse and validate command-line options, call retrieval use cases, print results, and do not implement query planning, deduplication, or ranking logic

### Requirement: Hybrid retrieval behavior is documented
The system SHALL document the new retrieval workflow, Evidence Pack fields, ranking semantics, and module ownership.

#### Scenario: Retrieval documentation explains Evidence Packs
- **WHEN** retrieval documentation is inspected
- **THEN** it describes query planning, structured retrieval, semantic retrieval, deduplication, ranking, Evidence Pack fields, and the meaning of warnings

#### Scenario: Architecture documentation reflects retrieval responsibilities
- **WHEN** architecture documentation is inspected
- **THEN** it describes retrieval as the owner of query planning, structured/semantic orchestration, merging, deduplication, ranking, and Evidence Pack generation

#### Scenario: Roadmap documentation reflects milestone completion
- **WHEN** roadmap documentation is inspected after implementation
- **THEN** it includes the hybrid retrieval and Evidence Pack milestone status and any documented limitations

