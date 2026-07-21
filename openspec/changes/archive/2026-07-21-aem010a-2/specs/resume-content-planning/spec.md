## MODIFIED Requirements

### Requirement: Missing requirements remain explicit
Atomic components that the Curated Evidence Pack marks missing or leaves uncovered MUST remain in the plan's uncovered component collection and MUST NOT be targeted or described as covered by generated content. A covered component beneath a `partial` parent MAY be targeted only by evidence selected for that component, while the plan MUST NOT represent the parent requirement as wholly covered. Parent uncovered requirement IDs remain available for legacy compatibility and source-level summaries.

#### Scenario: One component has no selected evidence
- **WHEN** a Docker and Kubernetes parent has covered Docker and missing Kubernetes
- **THEN** the plan may use selected Docker evidence, lists Kubernetes as an uncovered component, and does not claim the full parent requirement is covered

#### Scenario: Bullet targets an uncovered component
- **WHEN** a bullet targets a missing component or cites evidence not selected for that component
- **THEN** deterministic validation rejects the complete plan

#### Scenario: Legacy parent has no component data
- **WHEN** a compatible historical Curated Evidence Pack marks a parent requirement missing
- **THEN** its synthetic singleton component and parent ID remain uncovered with the same effective planning behavior as before

## ADDED Requirements

### Requirement: Planner input and output preserve component-level coverage
The compatible Curated Evidence Pack reader SHALL supply ordered parent and component coverage, and selected planning evidence SHALL identify every addressed component and parent requirement. Component-aware Resume Content Plans SHALL expose target component IDs and uncovered component IDs alongside existing parent requirement IDs.

#### Scenario: PostgreSQL is covered independently from Go
- **WHEN** a Curated Evidence Pack contains selected PostgreSQL evidence and missing Go coverage beneath one parent
- **THEN** the frozen planner input allows PostgreSQL as a target, preserves Go as uncovered, and retains their shared parent identity

#### Scenario: Evidence target is validated
- **WHEN** generated content targets a covered component
- **THEN** deterministic validation confirms that every cited evidence ID was selected for that component and that its parent target is traceable

### Requirement: Partial parent wording is bounded by component evidence
The planner prompt, structured schema, and deterministic validation SHALL prevent wording that generalizes evidence for one component to its compound parent or uncovered sibling. The planner MAY describe the covered component narrowly and MUST prefer omission when component scope cannot be stated safely.

#### Scenario: PostgreSQL evidence does not imply Go
- **WHEN** PostgreSQL is covered and Go is missing
- **THEN** accepted resume content may state the supported PostgreSQL fact but contains no Go claim or assertion that the combined parent is satisfied

#### Scenario: AWS evidence does not imply Terraform
- **WHEN** AWS is covered and Terraform is missing
- **THEN** accepted resume content may target AWS only and retains Terraform in uncovered components
