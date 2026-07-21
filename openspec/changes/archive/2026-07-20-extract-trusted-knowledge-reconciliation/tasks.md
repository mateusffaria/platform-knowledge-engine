## 1. Reconciliation Module Structure

- [x] 1.1 Create `src/modules/reconciliation` with domain, application ports, application use cases, infrastructure, and CLI interface folders following the repo's hexagonal layout.
- [x] 1.2 Move trusted-knowledge domain concepts into reconciliation-owned files, including `ClaimAssessment`, `ClaimStatus`, `Conflict`, `ConflictSeverity`, and `ReconciliationResult`.
- [x] 1.3 Keep `EvidenceClaim`, `KnowledgeAsset`, source references, and provenance types owned by the knowledge module.
- [x] 1.4 Add public reconciliation exports that let composition code wire the module without reaching into internal folders.

## 2. Application Contracts and Boundary Adapters

- [x] 2.1 Define reconciliation ports for reading assessable claim snapshots and claim sets from knowledge.
- [x] 2.2 Define reconciliation ports for persisting claim assessments and status transitions through knowledge-owned contracts.
- [x] 2.3 Define a retrieval-facing port for removing or refreshing embeddings when claim eligibility changes.
- [x] 2.4 Implement knowledge-side adapters or application services that satisfy reconciliation claim read/write ports without reconciliation importing knowledge infrastructure.
- [x] 2.5 Implement retrieval-side adapters or application services that satisfy reconciliation eligibility-change ports without reconciliation importing retrieval infrastructure.

## 3. Assessment and Review Use Cases

- [x] 3.1 Move deterministic claim normalization and signature helpers into reconciliation.
- [x] 3.2 Move conflict detection rules into reconciliation and preserve the rule that missing evidence is not a conflict.
- [x] 3.3 Move claim assessment logic for `confirmed`, `single_source`, and `needs_review` outcomes into reconciliation.
- [x] 3.4 Move review listing, claim confirmation, and claim rejection use cases into reconciliation.
- [x] 3.5 Ensure user confirmation and rejection override automated assessment until a later explicit review transition.
- [x] 3.6 Ensure rejected and superseded claims remain auditable but inactive.

## 4. CLI and Composition

- [x] 4.1 Move `pke claims review`, `pke claims confirm <claim-id>`, and `pke claims reject <claim-id> --reason "<reason>"` handlers into reconciliation CLI interfaces.
- [x] 4.2 Update `src/cli/index.ts` to register claims commands from reconciliation.
- [x] 4.3 Update ingestion composition so newly persisted claims are assessed by reconciliation after ingestion.
- [x] 4.4 Update review composition so eligibility changes trigger retrieval cleanup or reindex behavior through the retrieval-facing port.
- [x] 4.5 Preserve existing command names, arguments, and user-visible behavior.

## 5. Retrieval Eligibility

- [x] 5.1 Centralize claim indexing eligibility policy in reconciliation.
- [x] 5.2 Keep retrieval responsible for embedding text generation, vector persistence, vector cleanup, and search.
- [x] 5.3 Ensure `confirmed` and `single_source` claims remain indexable by default.
- [x] 5.4 Ensure `needs_review`, `rejected`, and `superseded` claims are excluded from semantic indexing and trusted retrieval.
- [x] 5.5 Verify stale embeddings are removed or refreshed when a claim transitions from indexable to non-indexable.

## 6. Documentation

- [x] 6.1 Update `docs/architecture.md` to describe ingestion, knowledge, reconciliation, and retrieval responsibilities.
- [x] 6.2 Update `docs/trusted-knowledge.md` to document reconciliation ownership, claim statuses, review workflow, and absence-versus-contradiction policy.
- [x] 6.3 Update `docs/adr/0003-trusted-knowledge-policy.md` if needed to reflect reconciliation as the validation policy owner.
- [x] 6.4 Keep README trusted-knowledge content concise and link to detailed documentation if README changes are needed.

## 7. Verification

- [x] 7.1 Add or update tests for no-conflict, compatible-corroboration, and contradictory-claim reconciliation behavior.
- [x] 7.2 Add or update tests for confirm and reject review transitions through reconciliation use cases.
- [x] 7.3 Add or update CLI tests proving existing `pke claims` commands still work after moving handlers.
- [x] 7.4 Add architecture boundary tests proving reconciliation does not import knowledge infrastructure, retrieval infrastructure, Drizzle schemas, pgvector adapters, or provider SDKs.
- [x] 7.5 Add or update retrieval tests proving rejected and superseded claims are excluded and stale embeddings are removed or refreshed.
- [x] 7.6 Run `npm run typecheck` and `npm test`.
