## Context

The project already has a modular monolith structure with ingestion, knowledge, retrieval, documents, and jobs modules. The first trusted-knowledge implementation added claim statuses, deterministic assessment, conflict detection, review CLI commands, and retrieval eligibility filtering, but those responsibilities currently live primarily inside the knowledge module and ingestion composition.

Reconciliation is now a distinct business capability: it evaluates claims from multiple sources, detects conflicts, records review decisions, and decides whether claims are eligible for trusted indexing and retrieval. Knowledge should continue to own `EvidenceClaim` identity, source references, persistence, and provenance. Retrieval should continue to own embeddings, vector storage, and search mechanics.

## Goals / Non-Goals

**Goals:**

- Create `src/modules/reconciliation` with `domain`, `application/ports`, `application/use-cases`, `infrastructure`, and `interfaces/cli` boundaries where needed.
- Move claim assessment, deterministic conflict detection, review transitions, review listing, and eligibility policy into reconciliation.
- Preserve current CLI behavior for `pke claims review`, `pke claims confirm`, and `pke claims reject`.
- Keep `EvidenceClaim` and provenance ownership in knowledge.
- Let reconciliation communicate with knowledge and retrieval through explicit application contracts.
- Preserve existing database data, claim status values, audit events, and migrations where possible.
- Add tests proving reconciliation behavior and module boundaries.
- Update architecture and trusted-knowledge documentation.

**Non-Goals:**

- LLM-based conflict resolution.
- Hybrid retrieval, reranking, or retrieval benchmarking.
- A web review UI.
- New source parsers.
- Resume, document, or evidence-pack generation.
- A wholesale database redesign.
- A new dependency injection framework.

## Decisions

### Decision: Add reconciliation as the owner of assessment and review policy

`src/modules/reconciliation` will own the domain model and use cases for claim assessment, conflict detection, review decisions, and indexing eligibility. Domain concepts include `ClaimAssessment`, `ClaimStatus`, `Conflict`, `ConflictSeverity`, and `ReconciliationResult`.

Alternative considered: keep trusted-knowledge behavior in knowledge. That keeps the current code smaller, but it makes knowledge responsible for policy decisions that are broader than persistence and provenance.

### Decision: Keep EvidenceClaim ownership in knowledge

Knowledge remains the source of truth for `EvidenceClaim` identity, source references, knowledge assets, career records, and provenance. Reconciliation will not create competing claim identity or source models. It can use claim snapshots returned by explicit ports and can request assessment/status persistence through application contracts.

Alternative considered: move `EvidenceClaim` fully into reconciliation. That would centralize trust behavior, but it would blur the boundary between factual knowledge storage and policy evaluation.

### Decision: Communicate through application contracts, not infrastructure imports

Reconciliation application code will depend on reconciliation domain and ports only. It must not import knowledge repositories, Drizzle schema objects, retrieval vector stores, pgvector adapters, or provider SDKs. Composition code wires reconciliation ports to knowledge and retrieval application adapters.

Alternative considered: let reconciliation import the existing Drizzle trusted-claim repository directly. That would minimize refactoring, but it preserves the current boundary leak and makes reconciliation harder to test independently.

### Decision: Move claims CLI commands to reconciliation interfaces

The existing command surface remains:

- `pke claims review`
- `pke claims confirm <claim-id>`
- `pke claims reject <claim-id> --reason "<reason>"`

The registration and handlers move to `src/modules/reconciliation/interfaces/cli`. CLI code calls reconciliation use cases only; it does not reach into knowledge or retrieval use cases directly.

Alternative considered: leave CLI commands in knowledge and call reconciliation internally. That preserves file paths, but user review is part of reconciliation policy and should live with the related use cases.

### Decision: Reconciliation controls eligibility, retrieval performs indexing effects

Reconciliation decides whether a claim is eligible for indexing and trusted retrieval based on status. Retrieval remains responsible for embedding text, vector writes, vector deletes, and search. When review transitions make a claim non-indexable, reconciliation will invoke an explicit retrieval cleanup/reindex port.

Alternative considered: make retrieval compute claim eligibility from raw statuses. That works mechanically, but it spreads trusted-knowledge policy outside the reconciliation boundary.

### Decision: Preserve existing persistence and migrations where possible

Existing claim status columns and audit events remain valid. The extraction should move ownership and contracts first, not churn the schema. Additional migrations should be limited to gaps discovered during implementation, such as clarifying assessment persistence that cannot be represented by current fields.

Alternative considered: create dedicated reconciliation tables immediately. That may be useful later, but it increases migration risk without being required for the module extraction.

## Risks / Trade-offs

- [Risk] Moving code without changing behavior can still introduce subtle CLI or ingestion regressions -> Mitigation: keep focused approval tests around existing commands, ingestion assessment, and review transitions.
- [Risk] Boundary enforcement may be incomplete if tests only cover behavior -> Mitigation: add architecture tests that reject imports from reconciliation into knowledge infrastructure, Drizzle schemas, retrieval vector stores, and provider adapters.
- [Risk] Existing knowledge-domain types may be referenced broadly -> Mitigation: introduce reconciliation-owned types gradually and adapt knowledge claim snapshots at module boundaries.
- [Risk] Retrieval cleanup can become coupled to review use cases -> Mitigation: expose a narrow reconciliation port for eligibility-change effects and keep vector details inside retrieval.
- [Risk] Preserving existing migrations may leave table names that sound knowledge-owned -> Mitigation: document ownership clearly and defer renames unless they become necessary.

## Migration Plan

1. Create the reconciliation module structure and move trusted-knowledge domain logic behind reconciliation exports.
2. Introduce reconciliation ports for claim reads, assessment writes, review transitions, and retrieval eligibility-change effects.
3. Adapt knowledge application/infrastructure to satisfy reconciliation ports without reconciliation importing knowledge infrastructure directly.
4. Move review and assessment use cases into reconciliation and update ingestion composition to call reconciliation after claims are persisted.
5. Move claims CLI registration and handlers into reconciliation while preserving command names and output behavior.
6. Update retrieval integration so reconciliation policy determines eligibility and retrieval owns embedding cleanup/reindexing.
7. Update tests, architecture docs, and trusted-knowledge docs.

Rollback: keep the existing database schema and CLI command names stable. If extraction causes regressions, composition can temporarily wire commands back to the previous knowledge use cases while reconciliation boundaries are corrected.

## Open Questions

- Should `ClaimStatus` remain physically declared in knowledge model files for persistence compatibility during the first extraction, or should reconciliation own the exported type and knowledge map to it at the boundary?
- Should `superseded` transitions remain manual-only for this pass, or should reconciliation include deterministic supersession rules when a user confirms a newer incompatible claim?
