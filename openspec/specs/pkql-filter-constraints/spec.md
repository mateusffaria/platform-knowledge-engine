# Pkql Filter Constraints Specification

## Purpose
Defines the required behavior for the `pkql-filter-constraints` capability.

## Requirements

### Requirement: PKQL preserves compound filter values
The system SHALL parse a quoted PKQL filter value as one structured value without quote characters.

#### Scenario: Parses a quoted company value
- **WHEN** the user searches for `company:"Acme Knowledge Systems"`
- **THEN** the Query AST contains one `company` filter with value `Acme Knowledge Systems`
- **AND** the Query AST semantic text is empty

#### Scenario: Warns about an ambiguous unquoted compound value
- **WHEN** the user searches for `company:Acme Knowledge Systems`
- **THEN** the Query AST contains a `company` filter with value `Acme`
- **AND** the Query AST contains an actionable diagnostic recommending a quoted compound value

### Requirement: Unquoted text filters use normalized prefix matching
The system SHALL apply unquoted text PKQL filters as case-insensitive normalized prefix matches against their canonical structured fields.

#### Scenario: Matches a partial company value
- **WHEN** the user searches for `company:acme`
- **AND** canonical organization metadata contains `Acme Knowledge Systems`
- **THEN** structured retrieval includes evidence for `Acme Knowledge Systems`

#### Scenario: Quoted company value remains a structured-only query
- **WHEN** the user searches for `company:"Acme Knowledge Systems"`
- **THEN** retrieval uses structured search
- **AND** retrieval does not require semantic search

### Requirement: Explicit PKQL filters constrain mixed retrieval
The system SHALL apply every explicit PKQL filter as a candidate-set constraint before semantic ranking.

#### Scenario: Excludes unrelated organizations from a filtered query
- **WHEN** the user searches for `company:acme`
- **THEN** Evidence Pack items for organizations other than matching Acme organizations are excluded

#### Scenario: Ranks semantic text within the filtered organization
- **WHEN** the user searches for `company:"Acme Knowledge Systems" observability`
- **THEN** semantic retrieval ranks only evidence that satisfies the company filter

#### Scenario: Supports a partial mixed company query
- **WHEN** the user searches for `company:acme observability`
- **THEN** semantic retrieval ranks only evidence that satisfies the partial company filter

### Requirement: Pure semantic retrieval remains unfiltered
The system SHALL preserve global semantic retrieval behavior for queries with no explicit PKQL filters.

#### Scenario: Runs an unfiltered semantic query
- **WHEN** the user searches for `observability impact`
- **THEN** semantic retrieval runs without PKQL candidate constraints

