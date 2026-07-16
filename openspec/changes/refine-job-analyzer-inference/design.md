## Context

The jobs module persists a canonical source-derived job and immutable LLM analysis snapshots. The current `job-analyzer-v2` contract uses free-form signal values, has only `crossTeamLeadershipSignals`, and creates a new snapshot on every successful execution. It validates source excerpts and locations, but a valid reference can still accompany an inference that the supplied source does not support. Existing `job_analyses.analysis` JSON rows must remain consumable after the contract evolves.

## Goals / Non-Goals

**Goals:**

- Make the analyzer's output contract and prompt conservative, source-aware, and useful for retrieval normalization.
- Model collaboration, leadership, domain, and seniority signals with distinct, testable semantics.
- Preserve both canonical normalized values and the source wording from which they were derived.
- Define a deterministic analysis identity and reuse policy for equivalent repeated analysis requests.
- Read legacy persisted snapshots through a compatibility mapper while writing only the new contract.

**Non-Goals:**

- Reinterpreting or migrating historical analysis JSON in place.
- Changing canonical job ingestion, deterministic requirements, PKQL filters, or professional evidence.
- Inferring a seniority level from a title, years of experience, or responsibility scope when the source does not explicitly support that level.
- Adding provider types, tool use, background analysis, or a user-configurable domain taxonomy.

## Decisions

### Treat the prompt as a bounded extraction-and-normalization contract

Create `job-analyzer-v3` with an explicit output example and hard rules: infer only the smallest claim directly supported by the canonical source; omit a signal when its category cannot be established; do not turn ambiguity, coordination, communication, or a source reference into stakeholder management, leadership, or another competency. The schema remains the enforcement boundary: it validates the new shape, source-reference bounds, required seniority provenance, and normalized values before persistence. Warnings describe genuine uncertainty but cannot make otherwise unsupported output valid.

Alternative considered: rely solely on a stronger prompt. Prompt-only constraints are not sufficient to protect persisted or retrieval-facing data from malformed and semantically over-broad output.

### Use category-specific value objects and deterministic domain normalization

Replace the generic signal value for new snapshots with dedicated types. A domain signal contains `canonicalValue`, `sourceValue`, and optional source reference; a closed, code-owned alias map normalizes known equivalent forms (for example, “platform engineering” and “platform engineer” to one canonical domain) while unknown wording is retained as its own trimmed canonical value. A seniority signal contains `canonicalLevel`, `sourceValue`, `signalType`, and source reference. `canonicalLevel` is emitted only for an explicit seniority designation; `signalType` distinguishes explicit title, explicit requirement, and other explicitly stated seniority wording. Collaboration and leadership each retain a signal value and source reference, but are separate arrays.

The normalizer runs after schema parsing so equivalent provider spellings yield the same retrieval text. It preserves source wording verbatim enough for provenance and never invents a canonical term for a missing signal.

Alternative considered: keep generic signals and normalize only during retrieval. That would make stored analysis inconsistent, lose the relationship between source and canonical values, and leave downstream consumers to duplicate taxonomy logic.

### Separate semantic validity from source-reference validity

Keep the existing source-excerpt and line-range checks, then add category-aware validation and prompt rules. A source reference proves where text appeared, not that a broad interpretation follows from it. The analyzer output is rejected for structurally invalid category data; conservative interpretation is directed through the prompt and verified using mocked-provider tests covering known overreach. Ambiguities and warnings remain available for uncertain, bounded observations but are never substituted for an unsupported signal.

Alternative considered: automatically downgrade every questionable signal to a warning. That would permit unreliable content into a different field and conflict with the omission-first contract.

### Read legacy analysis JSON through an explicit compatibility mapper

Keep persisted snapshots immutable. At repository deserialization, identify legacy v2-shaped content from its stored prompt version and/or absent v3 fields, then adapt it to the current domain representation: generic domain values become both `sourceValue` and normalized `canonicalValue`; legacy seniority values retain their source wording and receive a `legacy-unclassified` signal type; legacy leadership remains leadership; collaboration is empty because it cannot be recovered reliably. New v3 snapshots are parsed as their native shape. The mapper is the sole compatibility seam, so retrieval and CLI output consume one current domain model.

Alternative considered: one-time JSON migration. That would alter historical evidence, cannot recover omitted distinctions, and makes rollback harder.

### Make reanalysis idempotent by a persisted analysis identity

Define an analysis identity from the canonical job content hash, analyzer contract/prompt version, provider identifier, and resolved model (including a CLI model override). Persist its deterministic hash/key with each new snapshot and enforce uniqueness for a job description plus identity. Before calling the provider, the analysis use case resolves the run identity and returns an existing successful matching snapshot; it calls the provider and persists a new immutable snapshot only when one identity component changes. A unique-constraint conflict from concurrent matching requests is resolved by loading and returning the stored matching snapshot.

This policy makes a repeat command deterministic at the persistence boundary while allowing intentional reanalysis through changed source content, prompt/contract version, provider, or model. Legacy snapshots have no identity and remain readable, but do not satisfy a v3 request.

Alternative considered: always append a snapshot and select the latest. It preserves history but makes identical commands non-idempotent and makes the active analysis dependent on provider variability and timing.

### Keep retrieval enrichment conservative and category-aware

Retrieval continues to consume analysis only as semantic text, never as a PKQL filter source. It includes normalized domain values and bounded collaboration/leadership/seniority text from the compatibility-mapped latest analysis, maintains analysis provenance and warning behavior, and does not synthesize seniority text when the analysis has no explicit seniority signal.

Alternative considered: use normalized values to expand deterministic filters. That would make probabilistic interpretation change deterministic retrieval constraints.

## Risks / Trade-offs

- [A finite alias map misses a legitimate equivalent domain] → Preserve the source value and default unknown values to their normalized textual form; add aliases only with tests.
- [Legacy analysis is less richly typed than v3] → Expose it through explicit compatibility defaults without inventing collaboration or seniority evidence.
- [Idempotent reuse prevents sampling a changed provider response] → A deliberate model or prompt-version change creates a new identity; a future force option can be proposed separately.
- [Prompt adherence cannot be proved exhaustively] → Combine narrow instructions, schema constraints, source validation, and deterministic mocked-provider regression tests.
- [Concurrent analysis requests race] → Use the unique identity constraint and load-after-conflict behavior.

## Migration Plan

1. Add nullable/additive analysis-identity persistence fields and a uniqueness constraint for newly written identities; retain the existing analysis JSON column and legacy rows unchanged.
2. Deploy the compatibility mapper before writing v3 snapshots so existing CLI and retrieval reads remain safe.
3. Release the v3 prompt, schema, normalizer, identity lookup, documentation, and tests together; new requests reuse only matching v3 identities.
4. Roll back application code without destructive migration. Legacy and v3 snapshots remain stored; the prior code can continue reading its rows if deployed against additive columns.

## Open Questions

- None. The initial canonical domain alias set will be intentionally small and test-driven; taxonomy expansion is a follow-on change.
