## ADDED Requirements

### Requirement: Compound requirements decompose into source-grounded atomic components
The system SHALL decompose a parent `JobRequirement` only when its parser identifies coordinated components that are each independently testable and directly supported by the parent source text. Every deterministic parent requirement MUST expose at least one atomic component, and decomposition MUST preserve the parent requirement and its original text.

#### Scenario: Coordinated technologies are decomposed
- **WHEN** a parent requirement contains “Strong knowledge of Go and PostgreSQL” and both coordinated terms are independently classified from the source
- **THEN** it has distinct Go and PostgreSQL components beneath the unchanged parent requirement

#### Scenario: Additional coordinated technology pairs are decomposed
- **WHEN** a parent requirement contains “Terraform and AWS” or “Docker and Kubernetes” and each term is independently classified
- **THEN** each source term becomes a distinct ordered component without changing the parent text

#### Scenario: Conceptual phrase remains atomic
- **WHEN** a requirement contains ordinary coordinated wording that the parser cannot classify as independently testable requirements
- **THEN** the system retains one singleton component and does not split on the conjunction alone

#### Scenario: Unsupported component is not invented
- **WHEN** neither the exact source span nor deterministic classification supports a proposed component
- **THEN** the component is rejected and is not supplied to retrieval, reasoning, or planning

### Requirement: Atomic components have stable identity and provenance
Each atomic component SHALL contain a deterministic component identifier, parent requirement identifier, source order, component text, canonical type, optional normalized value, inherited importance, source excerpt/location, and its span within the original parent text. Component identity and ordering MUST be stable for the same persisted parent requirement.

#### Scenario: Component remains traceable to its parent
- **WHEN** PostgreSQL is extracted from a compound Go and PostgreSQL requirement
- **THEN** the component retains its own identifier, the parent requirement identifier, and the exact source-supported span and provenance

#### Scenario: Equivalent reads produce stable identities
- **WHEN** the same persisted job requirement is read repeatedly
- **THEN** its component identifiers and source order are identical

### Requirement: Parent coverage is derived deterministically from component coverage
The system SHALL derive parent requirement coverage only after component coverage is finalized. All `strong` components MUST yield parent `strong`; all `missing` components MUST yield parent `missing`; all `weak` components MUST yield parent `weak`; a mixture containing `missing` and any covered status MUST yield parent `partial`; and every other mixture or all-`partial` result MUST yield parent `partial`. Parent evidence IDs, factors, limitations, and explanation MUST be stable derivatives of the ordered component results.

#### Scenario: Covered and missing components produce partial parent coverage
- **WHEN** PostgreSQL is covered and Go is missing beneath the same parent
- **THEN** PostgreSQL coverage remains visible, Go remains missing, and the parent status is `partial`

#### Scenario: All strong components produce strong parent coverage
- **WHEN** every component of a parent requirement has finalized `strong` coverage
- **THEN** the parent status is `strong`

#### Scenario: All missing components produce missing parent coverage
- **WHEN** every component of a parent requirement has finalized `missing` coverage
- **THEN** the parent status is `missing`

#### Scenario: Model-supplied parent status is not authoritative
- **WHEN** a reasoner response includes or implies a parent status inconsistent with component outcomes
- **THEN** deterministic finalization rejects or ignores that value and derives the specified parent status

### Requirement: Legacy requirements adapt to singleton components
The system SHALL read an existing persisted requirement or compatible historical pack that has no component collection as one synthetic singleton component derived deterministically from the parent identity and content. Adaptation MUST NOT rewrite the historical row, pack, run identity, or original text and MUST NOT infer unavailable distinctions.

#### Scenario: Existing persisted job has no component rows
- **WHEN** a pre-change job requirement is loaded
- **THEN** downstream processing receives one stable singleton component with the parent's type, importance, text, normalized value, and provenance

#### Scenario: Historical curated pack is read
- **WHEN** a compatible pre-change Curated Evidence Pack contains only parent coverage
- **THEN** its read model exposes equivalent singleton component coverage without changing the persisted snapshot
