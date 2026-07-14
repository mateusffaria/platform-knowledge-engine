## Why

The current canonical career model was enough to validate ingestion and retrieval, but it still mirrors resume sections and stores many professional facts as coarse text blobs. Rich professional sources need a domain model that separates durable career entities from atomic, provenance-backed assertions so reconciliation, retrieval, and future document generation can reason over professional knowledge rather than formatting.

## What Changes

- Replace the simplified canonical career taxonomy with richer `KnowledgeAsset` categories for profiles, organizations, experiences, roles, projects, initiatives, products, education, certifications, and skills.
- Evolve `EvidenceClaim` from section-level claim types into atomic assertions with explicit categories: `fact`, `responsibility`, `achievement`, `metric`, `capability`, and `relationship`.
- Make claims reference their subject asset instead of embedding complete canonical objects inside section-shaped records.
- Introduce structured predicates for career relationships and outcomes, including `works_at`, `holds_role`, `uses_technology`, `participated_in`, `occurred_during`, `reduced_processing_time`, `reduced_cost`, `improved_reliability`, and `demonstrates`.
- Preserve source provenance on claims, including original excerpt, source language, and original section label.
- Keep markdown ingestion, claim reconciliation, and semantic retrieval compatible while the richer model is introduced.
- Treat document sections as ingestion provenance only, not canonical entity types.

## Capabilities

### New Capabilities

- `canonical-career-model`: Defines the richer professional knowledge model, including persistent knowledge assets, atomic evidence claims, claim categories, predicates, provenance, multilingual source metadata, and compatibility expectations for ingestion, reconciliation, and retrieval.

### Modified Capabilities

- None. There are no existing mainline specs under `openspec/specs`; current behavior is captured in active change artifacts and implementation.

## Impact

- Domain model types in `src/modules/knowledge/domain/model.ts`.
- Database enums, tables, indexes, and migrations in `src/shared/database/schema.ts` and `drizzle/`.
- Markdown ingestion mapping in `src/modules/ingestion/infrastructure/parsers/markdown.ts`.
- Knowledge persistence and read repositories under `src/modules/knowledge/infrastructure/repositories/`.
- Reconciliation ports and use cases that assess, confirm, reject, or supersede evidence claims.
- Semantic and hybrid retrieval indexing, query planning, filtering, and evidence-pack assembly.
- Existing ingestion, reconciliation, retrieval, and CLI tests that assert claim types, asset types, source references, and embedding text.
