## 1. Domain Model

- [ ] 1.1 Expand `KnowledgeAssetType` to include professional profile, organization, professional experience, role, project, initiative, product, education, certification, and skill asset types.
- [ ] 1.2 Add domain types for evidence claim categories, structured predicates, subject asset references, optional related asset references, optional value/unit fields, source language, and original section labels.
- [ ] 1.3 Update canonical document/domain assertions so evidence claims remain provenance-backed and section labels cannot become canonical asset types.

## 2. Database and Migration

- [ ] 2.1 Update Drizzle enums and tables for richer knowledge asset types, claim categories, predicates, subject assets, related assets or values, source language, and original section label metadata.
- [ ] 2.2 Generate a migration that expands the schema without dropping existing source documents, claims, statuses, references, embeddings, or review events.
- [ ] 2.3 Add conservative backfill logic or SQL defaults that map existing simplified assets and legacy claim types into the enriched model.

## 3. Ingestion and Persistence

- [ ] 3.1 Update markdown parsing to create professional profile assets plus organization, experience, role, project, education, certification, and skill assets when present.
- [ ] 3.2 Split compound markdown evidence into atomic claims for facts, responsibilities, achievements, metrics, capabilities, and relationships where deterministic parsing supports it.
- [ ] 3.3 Preserve original excerpt, source language when known, original section label, and source reference identity for every emitted claim.
- [ ] 3.4 Update knowledge persistence repositories to save and read enriched assets and claims while preserving compatibility projections for existing ports.

## 4. Reconciliation Compatibility

- [ ] 4.1 Update claim reconciliation repository mappings to expose claim category, predicate, subject asset, related asset or value, readable claim text, status, confidence, conflict severity, and provenance.
- [ ] 4.2 Adjust claim assessment logic so enriched claims can be confirmed, rejected, superseded, or marked for review without losing structured fields.
- [ ] 4.3 Update claim review CLI output and tests to remain usable with enriched atomic claims.

## 5. Retrieval Compatibility

- [ ] 5.1 Update indexable knowledge readers and embedding text builders to include asset identity, claim identity, claim category, predicate, claim text, status, source reference, excerpt, source language, and original section label.
- [ ] 5.2 Update structured and hybrid retrieval types, filters, ranking inputs, and evidence-pack assembly to return enriched atomic claims while preserving existing trusted-status behavior.
- [ ] 5.3 Ensure rejected and superseded enriched claims remain excluded from trusted indexing and retrieval.

## 6. Verification

- [ ] 6.1 Add or update ingestion tests for richer assets, atomic claims, multilingual provenance, and section labels as provenance.
- [ ] 6.2 Add or update reconciliation tests for enriched claim assessment and review actions.
- [ ] 6.3 Add or update semantic and hybrid retrieval tests for enriched embedding text, structured predicates, trusted status filters, and evidence-pack output.
- [ ] 6.4 Run `npm run typecheck` and `npm test`.
