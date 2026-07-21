# Atomic Job Requirements

Job ingestion preserves each extracted sentence as a parent requirement and gives it one or more ordered atomic components. This prevents a coordinated phrase such as “Go and PostgreSQL” from becoming a single all-or-nothing retrieval, reasoning, or resume-planning decision.

## Model and decomposition

`JobRequirement` remains the stable parent and provenance boundary. Each `AtomicJobRequirement` records a deterministic component ID, parent ID, zero-based source index, original and normalized text, type, importance, source excerpt/location/section, and character offsets inside the parent text.

The deterministic parser splits only coordinated technologies or skills that it can classify independently. It recognizes conjunctions such as `and`, `or`, `&`, and commas when at least two supported canonical terms are present. Conceptual phrases, coordinated verbs, and unsupported conjuncts stay as one component. Every parent therefore has at least one component; no atomic identity is inferred by an LLM.

Component IDs are UUID-compatible SHA-256 derivations of the parent identity and component content. A legacy parent with no stored component rows is adapted in memory to one deterministic singleton component. Reading legacy data never inserts rows, rewrites snapshots, or changes an old run identity.

## Pipeline ownership

```text
parent requirement + ordered components
  → one retrieval intent and candidate group per component
  → one allowlisted reasoner decision per component
  → deterministic parent aggregation
  → component-aware curated evidence
  → component-aware resume planning and validation
```

Retrieval and canonical hydration execute independently for each component. Candidate Evidence Pack v5 retains lossless parent groups for compatibility, but nested component groups are authoritative for reasoner selection. Its hash includes component order, selected reasoner-visible content, diagnostic identity, and normalized warning pairs.

Evidence Reasoner prompt v8 can reference only the supplied parent IDs, component IDs, and per-component candidate IDs. Missing decisions receive a deterministic missing fallback. Canonical evidence is deduplicated across components and parents before the affected parent summaries are recomputed.

Parent coverage is a display and compatibility aggregate, never a substitute for component coverage:

| Component statuses | Parent status |
| --- | --- |
| all `strong` | `strong` |
| all `partial` | `partial` |
| all `weak` | `weak` |
| all `missing` | `missing` |
| any other mixture | `partial` |

The parent evidence, rejection, factor, and limitation collections are deterministic unions of their components. Display score weighting remains parent-based so decomposing a sentence does not increase its scoring weight.

## Resume safety boundary

Resume planning input freezes ordered component coverage and evidence-to-component associations. Resume Content Plan v2 retains parent IDs and adds `targetRequirementComponentIds` and `uncoveredRequirementComponentIds`. A covered component under a partial parent may be targeted without treating its missing sibling as covered.

The validator rejects unknown or missing component targets, evidence not associated with a target component, incorrect uncovered-component accounting, and broad parent wording that overstates a partially covered compound requirement. Legacy singleton plans remain readable through compatibility adaptation.

## CLI and diagnostics

Use the existing commands:

```bash
npm run pke -- jobs ingest examples/job.md --json
npm run pke -- jobs show <job-id> --json
npm run pke -- jobs candidates <job-id> --verbose
npm run pke -- jobs reason <job-id> --verbose
npm run pke -- documents resume plan <job-id> --verbose
```

JSON output is lossless and includes parent/component identities and provenance. Human output reports parent and atomic-component counts; verbose candidate/reasoning/planning output shows component IDs and selections. Diagnostics distinguish parent requirement count, atomic component count, and selected evidence count per component. Warnings are normalized to stable `{ code, message }` pairs, deduplicated by the exact pair, and sorted deterministically; legacy string warnings are adapted at read boundaries.

## Storage and migration

`drizzle/0012_add_job_requirement_components.sql` additively creates `job_requirement_components` with a parent foreign key, unique `(job_requirement_id, component_index)` ordering, identity and parent indexes, canonical fields, and source provenance. Existing `job_requirements` rows are not altered or backfilled.

Apply with `npm run db:migrate`. Application writes store parents and validated components in one transaction. Rollback is application-safe by deploying a reader that ignores the additive table; a destructive schema rollback is unnecessary. Preserve the table when reverting code so historical component identities remain available.

