# ADR 0003: Trusted Knowledge Policy

## Status

Accepted

## Context

Professional source material can be incomplete, duplicated or contradictory. The system already preserves source references and can index knowledge semantically, but retrieval needs an explicit eligibility policy so unreviewed conflicts and rejected claims do not become trusted evidence.

## Decision

Evidence claims will carry explicit trust status and assessment metadata.

The supported statuses are:

- `confirmed`
- `single_source`
- `needs_review`
- `rejected`
- `superseded`

Deterministic rules compare normalized claim signatures and structured career fields where possible. Human review can confirm or reject claims through the CLI. Status transitions are persisted in an append-only audit table.

`confirmed` and `single_source` claims are searchable by default. `needs_review`, `rejected` and `superseded` claims are excluded from trusted semantic indexing and generated outputs.

## Rationale

The project thesis is that LLMs should compose outputs from verified evidence, not invent or authorize career facts.

Deterministic validation is reproducible and testable. User review provides the override path when automation cannot safely decide. Treating absence of evidence separately from contradiction avoids penalizing sparse but valid sources.

## Consequences

Positive consequences:

- Rejected and superseded claims cannot leak into trusted retrieval.
- Conflicting claims can be routed to review instead of being merged silently.
- Status changes remain auditable.
- Search can still be useful with single-source local knowledge.

Trade-offs:

- Conflict detection is conservative and may miss nuanced contradictions.
- Some useful claims may require manual review before they become active.
- Source reliability scoring is initially simple and may need refinement.

## Alternatives Considered

### LLM-based conflict resolution

Rejected for this milestone because it would make trust decisions less reproducible and harder to test.

### Require confirmation before search

Rejected for the default workflow because local professional knowledge often starts from a single authoritative profile. `single_source` claims remain searchable, but status metadata must remain visible.
