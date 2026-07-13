## Context

The project already ingests Markdown career sources into canonical knowledge assets, source references, evidence claims, and career record tables. Retrieval can index eligible `KnowledgeAsset` and `EvidenceClaim` records into `knowledge_embeddings` and search them through application ports, but claim eligibility is currently implicit.

This change introduces an explicit trust model for professional claims. The trust model must remain deterministic, auditable, and local-first: LLMs can later help compose outputs from trusted evidence, but they must not be the authority for whether a claim is true.

## Goals / Non-Goals

**Goals:**

- Persist claim validation state for `confirmed`, `single_source`, `needs_review`, `rejected`, and `superseded`.
- Record confidence score, conflict severity, review timestamp, review reason, and traceable status changes.
- Detect conflicts deterministically and distinguish absence of supporting evidence from contradictory evidence.
- Assess newly ingested claims and route conflicting or low-confidence claims to human review.
- Add CLI review commands to list, confirm, and reject claims.
- Make retrieval indexing and generated-output eligibility depend on claim status.
- Remove or refresh embeddings when a claim's eligibility changes.
- Document the trusted-knowledge policy outside the README.

**Non-Goals:**

- LLM-based conflict resolution or automatic merging of high-severity conflicts.
- Web review UI.
- Resume or document generation.
- Full hybrid retrieval, reranking, or benchmarking.
- A new dependency injection framework.

## Decisions

### Decision: Treat claim status as domain state with append-only review events

`EvidenceClaim` will gain status and assessment fields in the knowledge domain and persistence schema. Status transitions will also be written to an append-only review/audit table that records the claim id, previous status, next status, reason, timestamp, and actor/source such as `system` or `user`.

Alternative considered: store only the latest status fields on `evidence_claims`. That is simpler, but it does not satisfy the traceability requirement once claims are confirmed, rejected, or superseded repeatedly over time.

### Decision: Use deterministic claim signatures for first-pass conflict detection

The conflict detector will compare claims by deterministic, normalized signatures derived from claim type and structured fields available from career records where possible. For example, experience conflicts can compare normalized role, organization, and date attributes; project and skill conflicts can compare normalized names and values. Free-form claim text can still participate through normalized text, but high-confidence conflict rules should prefer structured attributes.

Alternative considered: use embeddings or an LLM to infer contradictions. That could catch more nuanced conflicts, but it would make trust decisions harder to reproduce and violates the requirement that deterministic rules and user review take precedence over LLM judgment.

### Decision: Absence is represented separately from contradiction

Assessment will only mark a conflict when two or more available claims assert incompatible values for the same factual attribute. A source that simply omits a skill, project, date, organization, or achievement will not lower confidence or create a conflict by itself.

Alternative considered: penalize claims not found in every source. That would incorrectly treat incomplete documents as contradictory and would make sparse but valid evidence less useful.

### Decision: Default single-source claims to searchable but not confirmed evidence

`single_source` claims will be indexed and searchable by default with visible status metadata, because local professional history often starts with one authoritative source. `confirmed` claims remain the strongest trusted evidence. `needs_review`, `rejected`, and `superseded` claims are excluded from trusted semantic indexing and generated outputs until status changes make them eligible.

Alternative considered: require confirmation before any claim is searchable. That maximizes caution but makes initial ingestion much less useful and conflicts with the local-first CLI workflow.

### Decision: Keep assessment orchestration in the knowledge module and indexing reactions in retrieval

The knowledge module will own claim assessment, conflict detection, review listing, and status transitions. Retrieval will expose an application use case or port for removing or refreshing embeddings by subject when claim eligibility changes. CLI composition can call both modules without either module importing the other's infrastructure.

Alternative considered: put all eligibility behavior in retrieval. That centralizes embedding effects, but it makes trust state a retrieval concern instead of a core knowledge concern.

### Decision: Persist source reliability as explicit source metadata with conservative defaults

Source reliability or priority will be stored with source document metadata and surfaced in claim assessment. Existing Markdown ingestion will default to a neutral reliability unless explicit metadata is provided later. Reliability can influence confidence and review ordering, but it will not override a detected contradiction or a user review decision.

Alternative considered: create a separate source registry before adding validation. That may be useful later, but metadata on current source documents is enough for the first local-first workflow.

## Risks / Trade-offs

- [Risk] Current claims are mostly free-form text, so deterministic conflict detection may miss nuanced contradictions -> Mitigation: prefer structured career record fields where available, keep text rules conservative, and route ambiguous cases to review rather than auto-confirming.
- [Risk] Indexing `single_source` claims may surface claims before human confirmation -> Mitigation: return status metadata with results, exclude `needs_review`, `rejected`, and `superseded`, and document the default policy clearly.
- [Risk] Status changes can leave stale embeddings active -> Mitigation: centralize claim eligibility checks in the indexable knowledge reader and call retrieval cleanup after review transitions.
- [Risk] Adding status fields to existing claims can misclassify historical data -> Mitigation: migrate existing claims to `single_source` by default and let re-assessment promote or flag them deterministically.
- [Risk] Source reliability can be mistaken for truth -> Mitigation: reliability only adjusts confidence/review priority; user review and detected contradictions override scoring.

## Migration Plan

1. Add database enums/columns for claim status and conflict severity, plus confidence score, reviewed timestamp, review reason, and source reliability metadata defaults.
2. Add an append-only claim status event table for auditability.
3. Migrate existing evidence claims to `single_source` with neutral confidence and no conflict severity.
4. Add knowledge-domain types and use cases for assessing claims, listing claims requiring review, confirming claims, and rejecting claims.
5. Add deterministic conflict detection rules and tests for no-conflict, missing-evidence, low-conflict, and contradictory cases.
6. Update the indexable knowledge reader to include only eligible statuses and expose status metadata to embedding/search results where needed.
7. Add retrieval cleanup or reindex hooks for claim eligibility changes.
8. Add `pke claims review`, `pke claims confirm <claim-id>`, and `pke claims reject <claim-id> --reason "<reason>"`.
9. Add `docs/trusted-knowledge.md`, `docs/adr/0003-trusted-knowledge-policy.md`, and concise README links.

Rollback: disable the new claims CLI commands and keep migrated status fields as inert metadata. Existing ingestion and canonical career records remain available, and embeddings can be regenerated from eligible claim state after the issue is resolved.

## Open Questions

- Should source reliability metadata be configured through frontmatter, a separate CLI command, or both?
- Should `superseded` be set only by explicit user action in the first implementation, or can deterministic rules supersede lower-priority claims after confirmation?
