## MODIFIED Requirements

### Requirement: Candidate preparation is requirement-scoped and traceable
The system SHALL prepare Candidate Evidence Pack entries from atomic-component-scoped retrieval requests nested beneath their parent requirements. Each request and resulting candidate association MUST retain `requirementId`, `componentId`, `evidenceClaimId` when available, and `knowledgeAssetId` throughout retrieval, hydration, and association.

#### Scenario: Candidate is associated with its source requirement
- **WHEN** an atomic component of a deterministic job requirement produces canonical eligible evidence
- **THEN** the Candidate Evidence Pack associates that evidence with the originating component and preserves the parent requirement, component, claim, and asset identities

#### Scenario: Weak evidence remains observable
- **WHEN** canonical evidence is eligible but has a weak retrieval score for a component
- **THEN** the pipeline retains or explicitly ranks it lower and MUST NOT silently drop it during component association

### Requirement: Per-requirement pipeline diagnostics explain all outcomes
The system SHALL attach pipeline diagnostics to every Candidate Evidence Pack atomic component and aggregate component cardinalities beneath each parent requirement. Component diagnostics MUST include retrieval intent, raw structured and semantic result counts, eligible result count, canonical hydration count, component association count, selected-for-reasoner count, and ordered discard records with stage, reason, and available retrieval identities.

#### Scenario: Discarded result is traceable
- **WHEN** a raw retrieval result is not associated with a component
- **THEN** diagnostics contain its parent requirement and component identities, its `evidenceClaimId` or `knowledgeAssetId` when available, the stage where it was discarded, and an actionable reason

#### Scenario: No result is silently lost
- **WHEN** raw retrieval results, hydrated claims, and final associations are compared for a component
- **THEN** every item is retained, represented by an explicit discard record, or causes an actionable pipeline failure

## ADDED Requirements

### Requirement: Candidate diagnostics report parent and component cardinality
Candidate Evidence Pack diagnostics SHALL report the count of parent requirements, the count of atomic components, and the selected evidence count for every component. Counts MUST use documented units and MUST be stable for equivalent inputs.

#### Scenario: Compound and singleton requirements are prepared
- **WHEN** a job has two parent requirements containing three total atomic components
- **THEN** diagnostics report parent requirement count two, atomic component count three, and one selected-evidence count for each component

#### Scenario: Component has no selected evidence
- **WHEN** Kubernetes has no reasoner-selected candidate
- **THEN** its selected evidence count is zero while sibling Docker diagnostics remain unchanged
