## Why

The project now supports claim statuses, deterministic conflict detection, and human review, but those responsibilities are spread through existing knowledge and ingestion code. Reconciliation has emerged as its own business capability, so extracting it into a dedicated module clarifies ownership while preserving the current local-first trusted-knowledge behavior.

## What Changes

- Add a dedicated `src/modules/reconciliation` module with hexagonal boundaries.
- Move trusted-knowledge assessment, deterministic conflict detection, review decisions, and indexing-eligibility policy into reconciliation.
- Keep `EvidenceClaim`, `KnowledgeAsset`, source references, and provenance owned by the knowledge module.
- Introduce reconciliation domain concepts: `ClaimAssessment`, `ClaimStatus`, `Conflict`, `ConflictSeverity`, and `ReconciliationResult`.
- Add reconciliation application ports for reading claims, persisting assessments and review transitions, and notifying retrieval when eligibility changes.
- Move claims review, confirmation, and rejection CLI handlers into reconciliation interfaces while preserving the existing command surface.
- Update ingestion composition so newly persisted claims are reconciled through application contracts after ingestion.
- Update retrieval composition so reconciliation controls eligibility decisions while retrieval continues to own vector indexing and search.
- Preserve existing database data and migrations where possible.
- Update architecture and trusted-knowledge documentation, plus add module-boundary and reconciliation behavior tests.

## Capabilities

### New Capabilities

- `trusted-knowledge-reconciliation`: Covers reconciliation-owned claim assessment, deterministic conflict detection, human review decisions, auditable claim status, and trusted-evidence eligibility for indexing and retrieval.

### Modified Capabilities

- None.

## Impact

- Affected code: new `src/modules/reconciliation`, existing trusted-knowledge code under `src/modules/knowledge`, ingestion orchestration, retrieval indexing eligibility, CLI registration, tests, and documentation.
- Affected APIs: `pke claims review`, `pke claims confirm <claim-id>`, and `pke claims reject <claim-id> --reason "<reason>"` continue to work, but their implementation moves to reconciliation.
- Module boundaries: reconciliation application code must depend only on reconciliation domain and explicit ports; it must not import knowledge repositories, Drizzle schemas, retrieval vector stores, pgvector adapters, or provider adapters directly.
- Data and migrations: existing claim status fields and audit data are preserved unless a minimal migration is required for clearer reconciliation persistence.
- Documentation: architecture and trusted-knowledge docs must explain that reconciliation owns assessment and review policy, knowledge owns claims/provenance, and retrieval owns indexing/search mechanics.
