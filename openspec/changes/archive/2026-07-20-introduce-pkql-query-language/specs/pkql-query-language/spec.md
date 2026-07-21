## ADDED Requirements

### Requirement: PKQL parser separates filters from semantic text
The system SHALL parse retrieval query strings into a Query AST containing explicit PKQL filters and the remaining semantic text.

#### Scenario: Parses a single filter
- **WHEN** the user searches for `company:VTEX`
- **THEN** the Query AST contains a `company` filter with value `VTEX`
- **AND** the Query AST semantic text is empty

#### Scenario: Parses quoted filter values
- **WHEN** the user searches for `project:"Professional Knowledge Engine"`
- **THEN** the Query AST contains a `project` filter with value `Professional Knowledge Engine`
- **AND** the quote characters are not part of the parsed value

#### Scenario: Preserves mixed semantic text
- **WHEN** the user searches for `company:VTEX distributed systems observability`
- **THEN** the Query AST contains a `company` filter with value `VTEX`
- **AND** the Query AST semantic text is `distributed systems observability`

### Requirement: PKQL supports initial retrieval filters
The system SHALL support `company`, `role`, `technology`, `skill`, `project`, `status`, `after`, `before`, and `type` as PKQL filter fields.

#### Scenario: Parses supported professional filters
- **WHEN** the user searches for `company:Pismo technology:PostgreSQL status:confirmed`
- **THEN** the Query AST contains `company`, `technology`, and `status` filters with their parsed values

#### Scenario: Rejects unsupported explicit filters
- **WHEN** the user searches for `team:Platform observability`
- **THEN** the parser fails with a clear unsupported filter error

### Requirement: Query AST is the planner input contract
The retrieval planner MUST consume the parsed Query AST when selecting retrieval strategies.

#### Scenario: Structured-only PKQL query
- **WHEN** the Query AST contains at least one filter and empty semantic text
- **THEN** the planner selects structured retrieval
- **AND** the planner does not require semantic retrieval

#### Scenario: Semantic-only natural-language query
- **WHEN** the Query AST contains no filters and semantic text `evidence of leadership impact`
- **THEN** the planner selects semantic retrieval

#### Scenario: Mixed PKQL and natural-language query
- **WHEN** the Query AST contains a `technology` filter with value `Go` and semantic text `distributed tracing`
- **THEN** the planner selects structured and semantic retrieval

### Requirement: Planner avoids hardcoded language and technology vocabularies
The retrieval planner MUST NOT depend on natural-language stopword lists or hardcoded skill, technology, company, project, or role vocabularies.

#### Scenario: Metadata-backed structured signal
- **WHEN** `KnowledgeMetadataProvider` exposes `Temporal` as a technology and the user searches for `Temporal`
- **THEN** the planner can select structured retrieval without a hardcoded `Temporal` vocabulary entry

#### Scenario: Unknown bare term remains semantic
- **WHEN** `KnowledgeMetadataProvider` exposes no matching metadata and the user searches for `Temporal`
- **THEN** the planner treats the query as semantic text

### Requirement: Retrieval preserves semantic and evidence-pack behavior
The system SHALL preserve natural-language search, mixed search, and Evidence Pack output while introducing PKQL parsing.

#### Scenario: Natural-language search remains supported
- **WHEN** the user searches for `show evidence of platform leadership`
- **THEN** retrieval performs semantic search
- **AND** returns an Evidence Pack using the existing output shape

#### Scenario: Mixed query embeds only semantic text
- **WHEN** the user searches for `company:VTEX observability impact`
- **THEN** structured retrieval receives the parsed company filter
- **AND** semantic retrieval embeds `observability impact`

#### Scenario: Filter-only query skips semantic embedding
- **WHEN** the user searches for `status:confirmed`
- **THEN** structured retrieval receives the parsed status filter
- **AND** semantic retrieval is not executed solely because the original query was non-empty
