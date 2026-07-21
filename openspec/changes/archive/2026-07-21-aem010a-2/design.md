## Context

The canonical jobs model currently persists one `JobRequirement` per extracted bullet or paragraph. Retrieval, Candidate Evidence Packs, evidence reasoning, Curated Evidence Packs, and resume planning all use that parent requirement ID as their smallest unit. This is safe when a requirement is atomic, but a source such as “Strong knowledge of Go and PostgreSQL” becomes one retrieval and coverage decision. A missing Go claim can therefore hide valid PostgreSQL evidence, and downstream planning cannot use the supported component without implying support for the whole phrase.

The change crosses the jobs, retrieval, and documents boundaries, changes persisted job structure, and evolves immutable JSON pack contracts. It must preserve the original parent requirement and its provenance, remain conservative about splitting language, keep old rows and serialized curated packs readable, and preserve the existing rule that LLMs evaluate supplied evidence rather than invent job or career facts.

## Goals / Non-Goals

**Goals:**

- Represent every deterministic parent requirement as one or more independently addressable atomic components.
- Split only source-grounded coordinated terms that the deterministic parser can independently classify.
- Retrieve, associate, select, reason about, diagnose, and plan against components while retaining parent traceability.
- Derive parent coverage after component reasoning with a deterministic, tested function.
- Evolve persisted and serialized contracts without invalidating existing jobs, curated packs, or resume-planning reads.
- Produce stable cardinality diagnostics and warning sets.

**Non-Goals:**

- General-purpose natural-language clause parsing or LLM-based requirement decomposition.
- Splitting shared conceptual phrases, coordinated verbs, or arbitrary occurrences of “and”/“or”.
- Changing canonical evidence trust, retrieval scoring, or qualitative component-coverage semantics.
- Claiming that partial parent coverage satisfies a hiring requirement.
- Reprocessing or mutating immutable historical reasoning and resume-plan snapshots in place.

## Decisions

### 1. Persist components as children of an unchanged parent requirement

Add an `AtomicJobRequirement` domain value and a `job_requirement_components` table keyed by a stable component ID and `job_requirement_id`. A component contains its zero-based ordinal, exact source-supported component text, canonical type, optional normalized value, importance inherited from its parent, source excerpt/location, and character offsets within `JobRequirement.originalText`. `JobRequirement.originalText`, identity, source excerpt, source location, section label, and inference metadata remain unchanged.

Every newly ingested non-inferred parent receives at least one component. A non-compound requirement receives a singleton component rather than a nullable or empty component collection. This gives downstream code one uniform processing path.

Alternative considered: replace each compound parent with several `JobRequirement` rows. This was rejected because it loses the source-level grouping, changes established requirement IDs, and makes it harder to explain that the components came from one original requirement.

### 2. Use conservative deterministic decomposition

Decomposition runs after parent extraction and before persistence. It recognizes bounded coordination patterns only when every conjunct is an independently classifiable requirement value in the source text, such as canonical technologies in “Go and PostgreSQL”. Shared qualifiers may be carried into component display text, but the stored source span and canonical value must come from the matching conjunct. If any conjunct is ambiguous, classification fails, or the coordination expresses a shared conceptual capability, the parent remains a singleton component.

The decomposer returns source spans, and validation verifies that each component maps to a non-empty parent substring, has a unique ordinal/identity, and does not introduce normalized values absent from the source-supported parser result. Neither the Job Analyzer nor either planning/reasoning LLM may add or rename components.

Alternative considered: ask the existing LLM Job Analyzer to decompose arbitrary text. This was rejected because it would make canonical extraction provider-dependent and weaken the no-invention boundary.

### 3. Derive stable component identities from parent identity and source position

Component IDs are deterministic UUID-compatible values derived from a versioned namespace plus parent requirement ID, ordinal, exact source span, and normalized component text. Stable IDs make repeated adaptation, pack hashing, diagnostics, and tests reproducible without adding a runtime dependency. Source order is the canonical order; ID ordering is only a final tie-breaker.

Alternative considered: random IDs during ingestion. This was rejected because legacy singleton adaptation and deterministic reprocessing could not reproduce them.

### 4. Keep parent groups and nest component groups in pack contracts

`CandidateEvidencePack.requirements` remains parent-scoped for traceability, but each parent contains ordered component groups. Each component group owns its retrieval intent, complete candidate list, bounded reasoner selection, and pipeline diagnostics, and carries both `requirementId` and `componentId`. Candidate pack version and hash are advanced and include component identity, ordering, selected candidate references, and normalized warnings.

`CuratedEvidencePack.requirementCoverage` likewise remains parent-scoped and contains ordered `componentCoverage`. The LLM response schema exposes only component coverage decisions. Finalization validates all component/evidence references, performs cross-component selection deduplication, and then derives the existing parent fields. Recommended and discarded evidence remain flattened views, augmented with addressed component IDs where needed for downstream traceability.

Alternative considered: flatten components into the existing requirement arrays. This was rejected because repeated parent IDs would be ambiguous and consumers could no longer reconstruct the original source requirement without extra joins.

### 5. Aggregate parent coverage outside the LLM

After component validation and evidence deduplication, a pure function derives the parent status in this order:

1. all components `missing` → parent `missing`;
2. all components `strong` → parent `strong`;
3. all components `weak` → parent `weak`;
4. any mixture of `missing` and a non-missing status → parent `partial`;
5. every other mixed or all-`partial` result → parent `partial`.

Parent selected/rejected evidence IDs are stable unions of child values. Parent factors, limitations, and explanation are deterministic summaries that identify component outcomes; model-generated parent conclusions are ignored or rejected. Display scores continue to use parent status and importance so each source requirement is weighted once rather than once per component.

Alternative considered: use the minimum child status. This was rejected because `strong + missing` would become `missing` and erase real covered scope, which is the failure this change addresses.

### 6. Make resume planning component-aware without dropping parent IDs

The compatible planning input carries parent coverage and atomic component coverage. Selected evidence includes both addressed parent requirement IDs and component IDs. New plans may target `targetRequirementComponentIds` and record `uncoveredRequirementComponentIds`; parent `targetRequirementIds` and `uncoveredRequirementIds` remain for compatibility and source-level summaries. Deterministic validation permits a covered component to be targeted even when its parent is `partial`, rejects targeting a missing component, and rejects wording that represents a partial parent as wholly covered.

Legacy packs are exposed as one synthetic component per parent, so existing planning behavior remains unchanged for old inputs.

### 7. Normalize warnings as structured, stable diagnostics

Affected boundaries use a warning value with `code` and `message`. A shared normalizer trims values, adapts legacy strings to a stable legacy code, deduplicates by the exact `(code, message)` pair, and sorts by code then message before hashing, persistence, JSON output, and CLI rendering. Human output prints the message and may include the code in verbose mode.

Alternative considered: deduplicate strings only. This was rejected because different warning conditions can share wording and callers need stable machine-readable codes.

### 8. Version contracts and use compatibility adapters

The candidate pack, reasoner prompt/schema, Curated Evidence Pack content schema, and resume-planning prompt/schema receive new versions. Repository readers normalize legacy curated content into singleton component coverage without rewriting stored JSON. Legacy string warnings are normalized at read boundaries. Existing plan snapshots remain immutable and readable; only plans generated from component-aware packs use the new fields and identity inputs.

## Risks / Trade-offs

- [Conservative parsing leaves some valid compound requirements unsplit] → Start with independently classified coordinated technologies/skills, add fixture-driven patterns, and fall back to a singleton component on uncertainty.
- [Naive coordination parsing splits conceptual phrases] → Require every conjunct to have its own supported canonical classification and source span; cover coordinated verbs and ordinary phrases with negative tests.
- [One evidence claim is relevant to multiple components] → Permit distinct documented contributions, otherwise apply deterministic cross-component deduplication after reasoning and recalculate both component and parent status.
- [Legacy adaptation changes pack hashes or reuse behavior] → Never rewrite historical identities; select old snapshots through their existing identity and normalize only their read model. New component-aware runs use explicit new versions.
- [Nested contracts increase prompt size] → Apply the existing per-component selection limit and record total/selected cardinalities; do not duplicate canonical claim bodies at the parent level.
- [Parent `partial` compresses several child combinations] → Treat component coverage as authoritative for explanation and planning, and expose the full breakdown in JSON/verbose output.

## Migration Plan

1. Add the component table, indexes, domain types, deterministic ID/decomposition helpers, and repository writes/reads. Deploy the table additively; do not alter or delete parent rows.
2. Add the read-time singleton adapter for job requirements with no component rows and tests proving stable identities.
3. Evolve retrieval, candidate preparation, diagnostics, pack hashing, and CLI output behind a new candidate-pack version.
4. Evolve reasoner input/output schemas and prompt version, then finalize and persist nested component coverage through a new curated-content version while retaining legacy readers.
5. Evolve the documents compatibility reader, planning input/schema/prompt version, and validators for component targets.
6. Add fixtures, unit/integration/golden tests, observability fields, and documentation before enabling new component-aware generation by default.

Rollback keeps the additive table and new immutable snapshots in storage while reverting writers to the previous contract. Older binaries will continue to read pre-change snapshots but will not consume new-version packs; operators must deploy the compatibility-capable reader before generating new packs. No rollback step mutates historical content.

## Open Questions

None for proposal scope. The initial decomposer intentionally supports only fixture-proven coordinated independently classified values; expanding its grammar requires new positive and negative contract tests.
