# Trusted Knowledge

Trusted knowledge is the policy layer that decides whether an extracted `EvidenceClaim` can be used as professional evidence.

The reconciliation module owns this policy. Knowledge owns `EvidenceClaim` identity, source references and provenance. Retrieval owns embedding and search mechanics. Embeddings and LLM outputs are consumers of claim status; they do not decide whether a claim is true.

## Claim Statuses

- `confirmed`: corroborated by deterministic assessment or explicitly confirmed by the user. Eligible for semantic indexing, trusted retrieval and generated evidence outputs.
- `single_source`: supported by one source with no detected contradiction. Searchable by default, but surfaced with status metadata so consumers know it is not corroborated.
- `needs_review`: deterministic rules found a contradiction or ambiguity. Not eligible for trusted semantic indexing or generated outputs.
- `rejected`: explicitly rejected by the user. Never eligible for indexing, trusted retrieval or generated outputs.
- `superseded`: retained for audit history but inactive. Not eligible for indexing, trusted retrieval or generated outputs.

## Absence Is Not Contradiction

The system must not treat silence as a conflict.

If one source says "Go" and another source does not mention Go, that is missing evidence, not contradictory evidence. A conflict requires incompatible values for the same factual attribute, such as two different date ranges for the same role at the same organization.

## Review Workflow

Ingestion creates claims with conservative trust metadata, then invokes reconciliation after persistence. Reconciliation compares the new claims against existing evidence through explicit application contracts.

Use the CLI review commands:

```bash
npm run pke -- claims review
npm run pke -- claims confirm <claim-id>
npm run pke -- claims reject <claim-id> --reason "Unsupported by source material"
```

Confirming a claim marks it as trusted evidence. Rejecting a claim records the reason and asks retrieval to remove stale semantic embeddings for that claim.

All status transitions are recorded in `claim_status_events` so trust changes remain auditable.

## Eligibility Policy

| Status | Searchable by default | Generated output eligible | Active |
| --- | --- | --- | --- |
| `confirmed` | yes | yes | yes |
| `single_source` | yes | yes, with caution | yes |
| `needs_review` | no | no | no |
| `rejected` | no | no | no |
| `superseded` | no | no | no |

Reconciliation marks only `confirmed` and `single_source` claims as indexable by default. Retrieval performs the actual embedding writes, deletes and search operations. If a claim changes to a non-indexable status, reconciliation invokes retrieval cleanup so stale vectors are not returned.

## Deterministic Rules First

Conflict detection is deterministic. It uses normalized claim signatures and structured career fields where available.

Source reliability can influence confidence and review ordering, but it does not override a detected contradiction. User review takes precedence over automated confidence scoring.

LLMs may later compose outputs from trusted evidence, but they must not authorize career facts.
