## Why

The system can ingest, persist, embed, and semantically search professional knowledge, but it lacks an explicit trust model for claims that appear across multiple sources. Adding trusted-knowledge validation now prevents contradictory or rejected facts from being indexed or used as evidence while preserving an auditable review path.

## What Changes

- Extend evidence claims with validation status, confidence score, conflict severity, review timestamp, and review reason.
- Add claim statuses for `confirmed`, `single_source`, `needs_review`, `rejected`, and `superseded`.
- Add deterministic conflict detection that distinguishes contradictory evidence from missing evidence.
- Add source reliability or priority metadata that can influence confidence and review ordering.
- Add use cases to assess newly ingested claims, list claims requiring review, and confirm or reject claims.
- Add CLI commands for reviewing, confirming, and rejecting claims.
- Exclude rejected and superseded claims from semantic indexing and generated evidence outputs.
- Reindex or remove embeddings when claim eligibility changes.
- Document trusted-knowledge behavior outside the README, including claim-status eligibility policies.
- Add migrations and focused tests for claim assessment, conflict detection, review actions, and indexing eligibility.

## Capabilities

### New Capabilities

- `trusted-knowledge-validation`: Covers claim status, deterministic conflict detection, human review, auditability, and trusted-evidence eligibility for indexing and generated outputs.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/modules/knowledge`, `src/modules/ingestion`, `src/modules/retrieval`, `src/shared/database`, CLI interfaces, and focused tests under `tests/`.
- Affected APIs: new CLI commands `pke claims review`, `pke claims confirm <claim-id>`, and `pke claims reject <claim-id> --reason "<reason>"`; new application ports or domain services for conflict detection and claim assessment.
- Data and migrations: evidence claim persistence gains trust-status fields, source reliability metadata is persisted, and status changes remain traceable.
- Retrieval behavior: rejected and superseded claims must never be indexed or returned as trusted evidence; existing valid embeddings remain searchable, and eligibility changes trigger embedding removal or reindexing.
- Documentation: create `docs/trusted-knowledge.md` and `docs/adr/0003-trusted-knowledge-policy.md`; keep README concise with links to detailed policy documentation.
