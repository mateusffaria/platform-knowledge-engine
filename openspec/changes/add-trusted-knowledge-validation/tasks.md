## 1. Database and Domain Model

- [x] 1.1 Add claim status and conflict severity enums to the shared Drizzle schema.
- [x] 1.2 Extend `evidence_claims` with status, confidence score, conflict severity, reviewed timestamp, and review reason fields.
- [x] 1.3 Add an append-only claim status event table that records previous status, next status, reason, timestamp, and transition source.
- [x] 1.4 Add source reliability or priority metadata defaults for source documents.
- [x] 1.5 Generate and review the Drizzle migration for trusted-knowledge schema changes.
- [x] 1.6 Update knowledge domain types to include claim status, confidence, conflict severity, review metadata, and status events.

## 2. Claim Assessment and Conflict Detection

- [x] 2.1 Define knowledge application ports needed to read candidate claims, persist assessment results, and append status events.
- [x] 2.2 Implement deterministic claim normalization/signature helpers for supported claim and career record types.
- [x] 2.3 Implement conflict detection rules that distinguish missing evidence from contradictory values.
- [x] 2.4 Implement claim assessment logic for `confirmed`, `single_source`, and `needs_review` outcomes.
- [x] 2.5 Ensure source reliability can influence confidence and review ordering without overriding contradictions or user review decisions.
- [x] 2.6 Run assessment for newly ingested claims as part of the ingestion workflow.

## 3. Review Use Cases and CLI

- [x] 3.1 Add a use case to list claims requiring review with source context and conflict summary.
- [x] 3.2 Add a use case to confirm a claim and record an audit transition.
- [x] 3.3 Add a use case to reject a claim with a required reason and record an audit transition.
- [x] 3.4 Add `pke claims review` CLI command.
- [x] 3.5 Add `pke claims confirm <claim-id>` CLI command.
- [x] 3.6 Add `pke claims reject <claim-id> --reason "<reason>"` CLI command.

## 4. Retrieval Eligibility and Embedding Cleanup

- [x] 4.1 Update the indexable knowledge reader to include only `confirmed` and `single_source` claims by default.
- [x] 4.2 Include claim status metadata in indexable evidence claim records and search result context where applicable.
- [x] 4.3 Exclude `needs_review`, `rejected`, and `superseded` claims from semantic indexing and trusted retrieval.
- [x] 4.4 Add retrieval cleanup or reindex behavior when a claim changes from indexable to non-indexable.
- [x] 4.5 Verify existing valid embeddings remain searchable after trusted-knowledge eligibility filtering is added.

## 5. Documentation

- [x] 5.1 Create `docs/trusted-knowledge.md` documenting claim statuses, review workflow, search eligibility, and absence-versus-contradiction policy.
- [x] 5.2 Create `docs/adr/0003-trusted-knowledge-policy.md` documenting deterministic validation and user review as the authority over LLM judgment.
- [x] 5.3 Update README with concise trusted-knowledge links instead of detailed policy text.
- [x] 5.4 Update architecture or roadmap documentation for the trusted-knowledge validation workflow.

## 6. Verification

- [x] 6.1 Add tests for no-conflict and missing-evidence cases.
- [x] 6.2 Add tests for low-conflict or confidence-adjustment cases.
- [x] 6.3 Add tests for contradictory claims being marked `needs_review`.
- [x] 6.4 Add tests for confirm and reject review transitions, including audit event persistence.
- [x] 6.5 Add tests proving rejected and superseded claims are excluded from indexing and stale embeddings are removed or refreshed.
- [x] 6.6 Run `npm run typecheck` and `npm test`.
