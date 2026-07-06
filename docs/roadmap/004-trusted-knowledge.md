# AEM-004 — Trusted Knowledge

## Goal

Introduce evidence validation and conflict resolution.

## Problem

Different sources may contain incomplete or conflicting information.

Example:

- LinkedIn mentions Go.
- The resume does not mention Go.
- Personal notes mention Java instead.

The system must distinguish between absence of evidence and contradiction.

## Scope

- source confidence
- claim confidence
- claim status
- conflict detection
- human review workflow
- knowledge diff

## Claim Status Examples

- confirmed
- single_source
- needs_review
- rejected
- deprecated

## Out of Scope

- automatic truth determination for all conflicts
- UI dashboard
- resume generation

## Architectural Decisions

### Do not blindly merge

Conflicting information should not be merged automatically when it changes the meaning of the candidate profile.

### Feedback loop

Medium and high-impact conflicts should require user review.

### Traceability

Every claim should preserve references to its source documents.

## Acceptance Criteria

- The system can detect conflicting claims.
- The system can mark claims as needing review.
- Generated outputs cannot use rejected claims.
- Claim status is persisted.

## Risks

- Too much manual review may reduce usability.
- Too much automation may reduce trust.
- Confidence scoring may be subjective initially.

## Next Milestone

AEM-005 — Hybrid Intelligence.
