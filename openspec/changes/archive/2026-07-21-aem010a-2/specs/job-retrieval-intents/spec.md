## ADDED Requirements

### Requirement: Retrieval intents are generated per atomic component
The system SHALL generate a deterministic retrieval intent for every atomic component of each non-inferred parent requirement. Each component intent MUST use only that component's canonical value and source-supported text, retain both `componentId` and parent `requirementId`, and preserve parent importance and source order.

#### Scenario: Go and PostgreSQL retrieve independently
- **WHEN** a parent requirement has Go and PostgreSQL components
- **THEN** retrieval executes distinct component intents so an empty Go result cannot suppress PostgreSQL candidates

#### Scenario: Component has an exact canonical mapping
- **WHEN** a technology component has a normalized canonical value
- **THEN** its intent uses that value for the supported technology filter and uses component text for semantic retrieval

#### Scenario: Singleton component preserves existing behavior
- **WHEN** a parent requirement adapts to one component
- **THEN** its component intent is semantically equivalent to the prior parent-scoped intent and retains the parent identifier

### Requirement: Component intent ordering and warnings are deterministic
Component intents SHALL be ordered by parent requirement priority/source order and component source order with stable identity tie-breakers. Warnings produced while building intents MUST be normalized, deduplicated by code and message, and emitted in stable order.

#### Scenario: Equivalent intent builds are repeated
- **WHEN** the same component-aware job is used to build retrieval intents multiple times
- **THEN** intent order, query content, identity fields, and warnings are identical

#### Scenario: Two stages emit the same warning
- **WHEN** intent construction produces warnings with the same code and message more than once
- **THEN** the resulting warning collection contains one instance
