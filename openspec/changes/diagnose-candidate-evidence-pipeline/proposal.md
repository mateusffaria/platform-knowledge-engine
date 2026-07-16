## Why

The Evidence Reasoner can receive an empty Candidate Evidence Pack even when matching professional evidence exists in the canonical store. The current job retrieval path exposes only a final Evidence Pack, so it cannot show whether evidence was lost during intent generation, hybrid retrieval, eligibility filtering, canonical hydration, or requirement association.

## What Changes

- Add requirement-scoped candidate-evidence pipeline diagnostics covering retrieval intent, raw results, eligibility, canonical hydration, association, and every discard reason.
- Preserve `requirementId`, `evidenceClaimId`, and `knowledgeAssetId` through job retrieval, canonical hydration, and Candidate Evidence Pack construction.
- Add `pke jobs candidates <job-id>` and verbose diagnostics for `pke jobs retrieve <job-id>` so users can inspect the candidate input before LLM reasoning.
- Correct retrieval/hydration behavior so eligible semantic and structured evidence survives without requiring an exact structured predicate, both supported retrieval subjects hydrate canonically, and legacy/evolved claim representations are reconciled explicitly.
- Remove undocumented duplicate score thresholds and replace silent loss with explicit diagnostic records or actionable failures.
- Add end-to-end fixtures and tests for Go, PostgreSQL, AWS, technical leadership, Pismo/financial systems, and a deliberately missing Kubernetes requirement.

## Capabilities

### New Capabilities

- `candidate-evidence-pipeline-diagnostics`: Traceable requirement-to-candidate evidence preparation that explains every retained or discarded retrieval result before evidence reasoning.

### Modified Capabilities

- None.

## Impact

- Affected code: jobs retrieval/candidate use cases and CLI, retrieval result contracts and hybrid orchestration, canonical evidence reader/hydration adapters, reconciliation eligibility contracts, and diagnostics/candidate domain models.
- Affected APIs: requirement-aware retrieval and hydration inputs/outputs, Candidate Evidence Pack diagnostics, and `pke jobs candidates` / `jobs retrieve --verbose` output.
- Systems: PostgreSQL/pgvector remain behind retrieval and knowledge adapters; the Evidence Reasoner remains database-free and consumes only the completed Candidate Evidence Pack plus its diagnostics.
- Verification: new integration fixtures and end-to-end tests trace a job requirement from intent through final candidate association, including explicit no-evidence and legacy-record diagnostics.
