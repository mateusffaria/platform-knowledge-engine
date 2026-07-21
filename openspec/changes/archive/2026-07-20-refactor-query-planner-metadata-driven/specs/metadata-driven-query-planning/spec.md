## ADDED Requirements

### Requirement: Query planning uses parsed queries and normalized metadata matches
The retrieval planner MUST select retrieval strategies from the parsed Query AST and normalized MetadataMatch objects, without fetching persisted metadata or inspecting provider-specific metadata structures.

#### Scenario: Planner receives exact metadata match
- **WHEN** the Query AST contains semantic text `Temporal`
- **AND** the metadata matcher returns an exact `technology` match for `Temporal`
- **THEN** the planner selects structured retrieval
- **AND** the planned query exposes the matched metadata as structured retrieval input

#### Scenario: Planner receives no metadata matches
- **WHEN** the Query AST contains semantic text `leadership impact`
- **AND** the metadata matcher returns no matches
- **THEN** the planner selects semantic retrieval
- **AND** the planned query contains no structured metadata terms

### Requirement: Metadata matcher returns canonical categories and match types
The system SHALL normalize persisted professional metadata into MetadataMatch objects before query planning.

#### Scenario: Returns supported metadata categories
- **WHEN** persisted metadata contains skills, technologies, organizations, roles, projects, products, and initiatives
- **THEN** metadata matches use the canonical categories `skill`, `technology`, `organization`, `role`, `project`, `product`, and `initiative`

#### Scenario: Returns supported match types
- **WHEN** a query matches persisted metadata by full value, normalized prefix, normalized substring, or configured alias
- **THEN** the metadata matcher labels the match type as `exact`, `prefix`, `partial`, or `alias`

#### Scenario: Normalizes localized aliases
- **WHEN** persisted metadata defines equivalent English and Portuguese aliases for the same role or technology
- **THEN** English and Portuguese queries return MetadataMatch objects with the same canonical category and canonical value

### Requirement: Planner contains no professional vocabulary or language term lists
The retrieval planner MUST NOT contain hardcoded skill, technology, organization, role, project, product, or initiative vocabularies, and MUST NOT contain language-specific natural-language term lists.

#### Scenario: New technology requires no planner code change
- **WHEN** persisted metadata starts exposing `Temporal` as a technology
- **AND** the metadata matcher returns a technology match for `Temporal`
- **THEN** the planner can select structured retrieval without any `Temporal` entry in planner code

#### Scenario: New organization requires no planner code change
- **WHEN** persisted metadata starts exposing `Acme Knowledge Systems` as an organization
- **AND** the metadata matcher returns an organization match for `acme`
- **THEN** the planner can select structured retrieval without any organization vocabulary entry in planner code

#### Scenario: New role requires no planner code change
- **WHEN** persisted metadata starts exposing `Staff Engineer` as a role
- **AND** the metadata matcher returns a role match for a Portuguese alias of that role
- **THEN** the planner can select structured retrieval without any Portuguese role vocabulary entry in planner code

### Requirement: Strategy selection remains deterministic
The retrieval planner SHALL deterministically select structured retrieval, semantic retrieval, or both from explicit filters, metadata matches, and remaining semantic text.

#### Scenario: Explicit filter only uses structured retrieval
- **WHEN** the Query AST contains a `company` filter and empty semantic text
- **AND** the metadata matcher returns no matches
- **THEN** the planner selects structured retrieval

#### Scenario: Metadata match only uses structured retrieval
- **WHEN** the Query AST contains semantic text that exactly matches one metadata value
- **AND** the metadata matcher returns an exact match for the full semantic text
- **THEN** the planner selects structured retrieval
- **AND** the planner does not require semantic retrieval

#### Scenario: Conceptual text uses semantic fallback
- **WHEN** the Query AST contains semantic text with no explicit filters
- **AND** the metadata matcher returns no matches
- **THEN** the planner selects semantic retrieval

#### Scenario: Mixed PKQL and free text uses both strategies
- **WHEN** the Query AST contains a `technology` filter and semantic text `leadership impact`
- **THEN** the planner selects structured and semantic retrieval in deterministic order

#### Scenario: Metadata match with conceptual free text uses both strategies
- **WHEN** the Query AST contains semantic text `Temporal leadership impact`
- **AND** the metadata matcher returns a technology match for `Temporal`
- **THEN** the planner selects structured and semantic retrieval

### Requirement: Explicit filters constrain mixed retrieval
The system SHALL apply explicit PKQL filters as candidate-set constraints before semantic ranking.

#### Scenario: Mixed explicit filter limits semantic ranking
- **WHEN** the user searches for `company:acme observability`
- **THEN** semantic retrieval ranks only candidates that satisfy the explicit company filter

#### Scenario: Filter-only query skips semantic embedding
- **WHEN** the user searches for `company:"Acme Knowledge Systems"`
- **THEN** retrieval uses structured search
- **AND** semantic retrieval is not executed solely because the original query was non-empty

### Requirement: Metadata-driven planning is documented
The system SHALL document how PKQL parsing, metadata matching, and query planning divide retrieval responsibilities.

#### Scenario: Retrieval documentation names planner inputs
- **WHEN** retrieval documentation is inspected
- **THEN** it describes Query AST and MetadataMatch objects as planner inputs
- **AND** it identifies metadata matching as the owner of aliases, localization, and persisted vocabulary matching

#### Scenario: PKQL documentation preserves filter semantics
- **WHEN** PKQL documentation is inspected
- **THEN** it explains that explicit filters remain candidate-set constraints even when metadata matches are also present
