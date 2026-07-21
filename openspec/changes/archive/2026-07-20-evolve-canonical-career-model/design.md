## Context

The current knowledge domain stores a single `canonical-career-document` asset and section-shaped records for skills, experiences, projects, and achievements. Evidence claims already exist, but their `claimType` values mirror those records and `claimText` often contains a complete resume bullet rather than one auditable assertion.

This change moves the model toward professional knowledge as a graph of persistent assets and evidence-backed atomic claims. Ingestion still starts from markdown resume-like sources, but source sections become provenance metadata instead of canonical concepts.

## Goals / Non-Goals

**Goals:**

- Model durable professional entities independently of resume structure.
- Represent evidence as atomic claims that reference subject assets and optionally related assets, values, units, and predicates.
- Preserve provenance needed for trust, multilingual sources, reconciliation, and retrieval.
- Keep existing ingestion, reconciliation, semantic indexing, and hybrid retrieval usable during migration.
- Provide a migration path from existing section-shaped claims and records into the richer model.

**Non-Goals:**

- Add LLM extraction or entity resolution beyond deterministic markdown ingestion.
- Build a UI for editing the career graph.
- Remove the existing claim review workflow.
- Require embedding credentials for ingestion.
- Support arbitrary ontology editing by users in this change.

## Decisions

### Use richer `KnowledgeAsset` types instead of section records as canonical entities

`KnowledgeAsset` becomes the durable identity surface for `professional_profile`, `organization`, `professional_experience`, `role`, `project`, `initiative`, `product`, `education`, `certification`, and `skill`.

Rationale: these are professional-domain concepts that can be reused across sources, reconciled, retrieved, and cited. Resume sections such as "Experience" or "Skills" vary by document and language, so they remain source metadata.

Alternative considered: add `education` and `certification` tables beside the existing `skills`, `experiences`, `projects`, and `achievements` tables. That keeps the current shape familiar but continues coupling canonical knowledge to resume formatting and makes cross-entity relationships harder to query.

### Normalize claims around subject, category, predicate, and optional object/value

`EvidenceClaim` gains a claim category (`fact`, `responsibility`, `achievement`, `metric`, `capability`, `relationship`), a `subjectAssetId`, a structured predicate, and optional target fields for related assets or scalar values. Human-readable claim text remains for review, embedding text, and CLI output.

Rationale: most career evidence has a small assertion shape: a subject had a role, used a technology, achieved an outcome, demonstrated a capability, or changed a metric. This lets reconciliation and retrieval inspect structure without losing readable text.

Alternative considered: encode the richer structure in JSON metadata on existing `claimText` rows. That would reduce migration size but hide core behavior from TypeScript types, database constraints, and structured retrieval.

### Keep predicates constrained but extensible in application code

Initial predicates include `works_at`, `holds_role`, `uses_technology`, `participated_in`, `occurred_during`, `reduced_processing_time`, `reduced_cost`, `improved_reliability`, and `demonstrates`. The domain model exposes a typed union for first-class predicates and a fallback path for future predicate strings only when explicitly allowed by the parser or migration layer.

Rationale: known predicates make tests, retrieval filters, and migrations deterministic while still leaving a path for new professional relationships.

Alternative considered: use free-form predicate strings everywhere. That makes ingestion easy but weakens compatibility and creates noisy retrieval filters.

### Preserve compatibility through projections and indexing text

Existing workflows continue to see claim status, confidence, conflict severity, claim text, knowledge asset identity, source reference identity, and embedding subjects. Repositories can expose compatibility projections for current CLI and retrieval types while implementation migrates to the richer tables and enums.

Rationale: the current project already has claim review, semantic indexing, and hybrid evidence packs. The model should enrich those flows without forcing a flag-day rewrite.

Alternative considered: replace all ports at once. That would produce cleaner final types but create unnecessary risk across ingestion, persistence, reconciliation, and retrieval.

## Risks / Trade-offs

- Data migration can produce overly coarse claims from historical blobs -> backfill legacy rows conservatively, preserving original `claimText` and marking migrated structure as derived.
- Predicate taxonomy may be incomplete -> keep the first set small, test-covered, and easy to extend through domain types and migrations.
- Retrieval could lose recall if embedding text becomes too structured -> include readable claim text, predicate labels, asset labels, source excerpts, and provenance in deterministic embedding documents.
- Reconciliation may over-merge claims with different subjects or predicates -> compare category, predicate, subject asset, related asset/value, source, and normalized text before assigning conflicts.
- Database enum changes are harder to roll back -> add new values and columns before removing or tightening old compatibility paths.

## Migration Plan

1. Expand domain types and database schema with richer asset types, claim categories, predicates, subject references, related asset/value fields, source language, and original section label.
2. Update markdown ingestion to emit professional assets and atomic claims while retaining source references and readable claim text.
3. Backfill existing `canonical-career-document`, `skill`, `experience`, `project`, and `achievement` records into the richer model using conservative predicates and categories.
4. Update persistence, indexable readers, reconciliation repositories, structured search, and embedding text builders to read the enriched model and expose compatibility projections where needed.
5. Keep previous fields or adapters until tests show ingestion, reconciliation, semantic indexing, hybrid retrieval, and claim CLI flows remain compatible.
6. Roll back by leaving expanded columns/tables unused and routing ingestion/repositories through the compatibility projection.

## Open Questions

- Should metric values store normalized numeric fields immediately, or begin as text plus optional unit and add numeric normalization later?
- Should asset reconciliation produce stable identities across source documents in this change, or only preserve enough structure for a later reconciliation pass?
- Which source language detection strategy should be used initially: explicit metadata, parser inference, or defaulting to unknown when absent?
