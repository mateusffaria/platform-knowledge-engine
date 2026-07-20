## ADDED Requirements

### Requirement: Evaluation datasets are versioned and validated
The system SHALL load evaluation datasets as immutable, versioned fixtures with stable dataset, scenario, requirement, evidence, and expectation identities. It MUST validate dataset schemas, referential integrity, uniqueness, normalized ordering, and a deterministic content hash before pipeline execution.

#### Scenario: Valid golden dataset is loaded
- **WHEN** `pke eval` loads the repository-owned golden dataset
- **THEN** it exposes the dataset ID, version, deterministic content hash, and stably ordered validated scenarios

#### Scenario: Fixture contains a dangling evidence ID
- **WHEN** an expectation refers to evidence absent from its scenario fixture
- **THEN** dataset validation fails before any evaluation pipeline stage executes

### Requirement: Evaluation uses isolated read-only fixture knowledge
The system SHALL execute golden scenarios against scenario-owned fixture inputs through read-only pipeline ports. Evaluation MUST NOT create, update, promote, reconcile, reject, supersede, or delete canonical knowledge or claim lifecycle state.

#### Scenario: Complete evaluation run finishes
- **WHEN** all golden scenarios have executed
- **THEN** canonical knowledge and claim status records are byte-for-byte unchanged while evaluation run records may be added to evaluation-owned storage

#### Scenario: Evaluation fixture contains trust states
- **WHEN** a scenario includes confirmed, rejected, superseded, and `needs_review` claims
- **THEN** the fixture is evaluated without importing those claims into the canonical store or changing their declared fixture states

### Requirement: Retrieval, association, and reasoning are evaluated independently
The system SHALL record separate typed results for retrieval, Candidate Evidence Pack association, and Curated Evidence Pack reasoning. Every expectation and failure MUST identify its owning stage, and a downstream stage whose required upstream input is unavailable MUST be marked blocked rather than failed by a fabricated downstream assertion.

#### Scenario: Retrieval omits an expected claim
- **WHEN** retrieval output lacks a stage-scoped expected evidence ID
- **THEN** the report records a retrieval assertion failure independently of candidate-association and reasoning outcomes

#### Scenario: Reasoning-only scenario supplies a candidate pack
- **WHEN** a scenario provides a valid fixed Candidate Evidence Pack as its reasoning input
- **THEN** the runner can evaluate reasoning selections and coverage without requiring retrieval or association output

#### Scenario: Candidate construction errors
- **WHEN** candidate association cannot produce its required Candidate Evidence Pack
- **THEN** its stage is recorded as errored and the dependent reasoning stage is recorded as blocked

### Requirement: Deterministic expectations are authoritative
The system SHALL decide evaluation pass/fail exclusively through deterministic, stage-scoped assertions in this milestone. Supported expectations MUST include expected evidence IDs, forbidden evidence IDs, top-K membership, minimum and maximum coverage status, expected missing requirements, maximum evidence count, required provenance, selected-ID membership in the supplied Candidate Evidence Pack, no fabricated evidence, and schema validity.

#### Scenario: All deterministic expectations pass
- **WHEN** every applicable observed value satisfies its typed golden expectation
- **THEN** the scenario passes without invoking an LLM judge

#### Scenario: Coverage is outside its allowed range
- **WHEN** a requirement's observed coverage is below its expected minimum or above its expected maximum under the ordering `missing < weak < partial < strong`
- **THEN** the coverage assertion fails with expected and observed statuses

#### Scenario: Evidence exceeds the maximum count
- **WHEN** a stage emits more evidence references than its configured maximum
- **THEN** the maximum-evidence-count assertion fails with the observed count

### Requirement: Fabricated and unsupported evidence is rejected
Every evidence ID selected by reasoning MUST exist in the supplied Candidate Evidence Pack and in the addressed requirement's candidate scope. The evaluation framework SHALL report an unknown, cross-requirement, or otherwise out-of-scope selected ID as fabricated or unsupported evidence.

#### Scenario: Reasoner selects an unknown ID
- **WHEN** reasoning output selects an evidence ID absent from the supplied Candidate Evidence Pack
- **THEN** schema/referential validity fails, the no-fabricated-evidence assertion fails, and the unsupported selection is identified without inventing evidence content

#### Scenario: Reasoner selects another requirement's candidate
- **WHEN** an evidence ID exists in the pack but not in the addressed requirement's candidate scope
- **THEN** the selection is reported as unsupported for that requirement

### Requirement: Missing requirements respect the closed fixture world
The system SHALL validate expected missing requirements against the scenario's eligible fixture evidence. A requirement declared unsupported by the fixture MUST remain missing and MUST NOT be penalized as a retrieval false negative or recall miss; a requirement with eligible fixture support MUST NOT be accepted as genuinely missing.

#### Scenario: Unsupported Kubernetes requirement remains missing
- **WHEN** the fixture contains no eligible Kubernetes evidence and the Curated Evidence Pack marks that requirement missing with no selection
- **THEN** the expected-missing assertion passes and the requirement is excluded from evidence-recall denominators

#### Scenario: Supported requirement is marked missing
- **WHEN** eligible golden evidence exists for a requirement but the result marks it missing
- **THEN** missing-evidence accuracy records an incorrect outcome and the applicable coverage expectation fails

### Requirement: Trust policy and provenance remain enforceable
The system SHALL support forbidden-evidence expectations for rejected, superseded, and `needs_review` claims at retrieval and downstream stages. It SHALL verify required provenance fields for applicable evidence and report incomplete provenance by evidence ID and missing field.

#### Scenario: Ineligible trust state reaches retrieval output
- **WHEN** retrieval returns an evidence ID whose fixture status is rejected, superseded, or `needs_review`
- **THEN** the retrieval trust-policy expectation fails and downstream reports preserve the originating stage

#### Scenario: Selected evidence lacks a source reference
- **WHEN** an expectation requires source-document and source-reference identities but selected evidence omits the source reference
- **THEN** the provenance assertion fails and provenance completeness reflects the omission

### Requirement: Initial golden scenarios cover critical evidence behavior
The repository-owned initial dataset SHALL include scenarios for exact TypeScript, Node.js, and PostgreSQL coverage; conceptual leadership selection excluding unrelated performance-only evidence; unsupported Kubernetes or Flutter remaining missing; an empty Candidate Evidence Pack producing all missing requirements and no evidence; redundant candidates retaining the strongest complementary evidence while rejecting weaker duplicates; and trust-policy exclusion of rejected, superseded, and `needs_review` claims.

#### Scenario: All golden scenarios are listed
- **WHEN** a user runs `pke eval list`
- **THEN** the output includes stable IDs and descriptions for all six required scenario families and the dataset version

#### Scenario: Empty candidate pack is reasoned about
- **WHEN** the empty-pack scenario executes reasoning
- **THEN** every requirement is missing, no evidence is selected, and no fabricated evidence assertion fails

#### Scenario: Redundant candidates are curated
- **WHEN** the redundant-candidates scenario executes
- **THEN** expectations verify selection of the strongest complementary evidence and rejection of specified duplicate or weaker alternatives

### Requirement: Evaluation reports preserve stage and assertion detail
The system SHALL produce a concise CLI report and stable JSON and Markdown representations for every run. Each report MUST identify passed and failed expectations by dataset, scenario, stage, expectation ID, machine-readable reason, and safe expected/observed values, and MUST summarize passed, failed, errored, and blocked stage counts.

#### Scenario: A mixed run completes
- **WHEN** a run contains both passing and failing scenarios
- **THEN** all scenario results are retained and the concise report groups failures by scenario and pipeline stage

#### Scenario: JSON report is requested
- **WHEN** a user requests JSON output for a run
- **THEN** stdout or the configured output file contains the versioned lossless report schema without human-only formatting

#### Scenario: Markdown report is requested
- **WHEN** a user requests Markdown output for a run
- **THEN** stdout or the configured output file contains summary tables and per-stage assertion details derived from the same report model

### Requirement: Evaluation runs and results are auditable
The system SHALL persist immutable evaluation run and scenario-stage result snapshots sufficient for `show` and report regeneration. A run MUST record dataset ID, dataset version and hash, git SHA, run status and timestamps, provider and model when applicable, prompt version when applicable, every encountered candidate-pack version, per-stage outcomes, assertion results, aggregate metrics, and report schema version.

#### Scenario: Reasoning run succeeds
- **WHEN** a model-backed evaluation run completes
- **THEN** its persisted snapshot records the effective provider, model, prompt version, candidate-pack version, dataset version/hash, and git SHA used for that run

#### Scenario: Historical run is shown
- **WHEN** a user runs `pke eval show <run-id>` with a supported report format
- **THEN** the system renders that immutable persisted snapshot without rerunning the evaluation pipeline

### Requirement: Quality metrics are calculated deterministically
The system SHALL aggregate evidence precision at K, evidence recall at K, requirement coverage accuracy, missing-evidence accuracy, unsupported-selection rate, provenance completeness, and schema-validation success rate from declared golden expectations and observed stage outputs. Undefined denominators MUST be reported as not applicable rather than zero.

#### Scenario: Top-K evidence includes two of three expected IDs
- **WHEN** the declared eligible expected set has three IDs and the first K results contain two
- **THEN** recall at K is `2/3` and precision at K uses only the observed results up to K as its denominator

#### Scenario: No selections are applicable
- **WHEN** a scenario correctly has no candidate evidence and no selected evidence
- **THEN** unsupported-selection rate and provenance completeness are reported as not applicable unless their denominator is defined by another applicable result

### Requirement: Performance metrics remain separate from quality metrics
The system SHALL report average reasoning latency and prompt and completion token usage in a performance metric group separate from all quality metrics. Missing provider usage data MUST NOT be interpreted as zero tokens, and latency or token values MUST NOT influence deterministic quality pass/fail.

#### Scenario: Provider omits token usage
- **WHEN** reasoning completes without numeric prompt or completion token counts
- **THEN** token aggregates are reported as unavailable while quality assertions and reasoning latency remain independently reportable

#### Scenario: Fast run fails quality assertions
- **WHEN** a low-latency reasoning result selects forbidden evidence
- **THEN** the report preserves the fast performance measurement and independently marks the quality assertion failed

### Requirement: Evaluation CLI supports list, scoped run, and show
The system SHALL provide `pke eval list`, `pke eval run`, `pke eval run <scenario-id>`, and `pke eval show <run-id>`. Running without a scenario ID MUST execute every scenario in the default golden dataset; running with an ID MUST execute only that validated scenario; a failed or errored run MUST return a non-zero exit status.

#### Scenario: Full golden run is requested
- **WHEN** a user runs `pke eval run`
- **THEN** every validated scenario in the default golden dataset executes in stable order and a single aggregate run report is produced

#### Scenario: One scenario is requested
- **WHEN** a user runs `pke eval run <scenario-id>` for a known scenario
- **THEN** only that scenario executes and the persisted run records the requested scope

#### Scenario: Unknown scenario is requested
- **WHEN** a user runs `pke eval run <scenario-id>` for an unknown ID
- **THEN** the command fails before pipeline execution and lists or points to available scenario IDs

#### Scenario: Interactive evaluation reports progress
- **WHEN** a user runs `pke eval run` in an interactive terminal with the default CLI format
- **THEN** transient elapsed-time feedback covers dataset loading, scenario execution, report storage, telemetry flush, and resource shutdown without becoming an application log or metric

#### Scenario: Evaluation progress is suppressed
- **WHEN** output is machine-readable, stderr is redirected, CI is active, or the user passes `--no-progress`
- **THEN** the evaluation command emits no transient terminal progress

### Requirement: Evaluation telemetry is optional and isolated
The system SHALL emit evaluation run, stage, assertion, aggregate quality, reasoning-latency, and token metrics through evaluation-specific observability contracts when configured. It SHALL attach dataset, dataset version/hash, git SHA, provider, model, prompt version, candidate-pack version, and stage outcomes to Langfuse evaluation runs when enabled. Telemetry and Langfuse failures MUST NOT change assertion outcomes, and evaluation backend failures MUST NOT affect non-evaluation CLI workflows.

#### Scenario: Langfuse is enabled
- **WHEN** an evaluation run executes with configured Langfuse integration
- **THEN** its trace contains safe evaluation/version metadata and stage outcomes without canonical evidence, prompt, or completion content by default

#### Scenario: Telemetry exporter fails
- **WHEN** metric or trace export fails during evaluation
- **THEN** the runner completes and reports deterministic evaluation outcomes with a bounded observability diagnostic

#### Scenario: Evaluation repository is unavailable
- **WHEN** evaluation storage initialization fails
- **THEN** the explicit `eval` command reports an actionable failure while ingestion, retrieval, jobs, claims, and document commands remain constructible and functional

### Requirement: Evaluation operation and roadmap are documented
The project SHALL document dataset authoring/versioning, fixture safety, expectation semantics, metric formulas, report formats, CLI examples, model and observability configuration, and failure isolation. The AEM-009 roadmap SHALL describe deterministic evidence retrieval and reasoning evaluation and MUST NOT claim ATS scoring, subjective writing evaluation, provider comparison, or LLM-as-judge as initial capabilities.

#### Scenario: Developer adds a golden scenario
- **WHEN** a developer follows the evaluation documentation
- **THEN** they can add and validate a versioned fixture, expectations, and stable scenario ID without modifying canonical knowledge

#### Scenario: Roadmap is reviewed
- **WHEN** AEM-009 roadmap documentation is read
- **THEN** its scope and acceptance criteria match the deterministic retrieval, candidate-association, reasoning, reporting, metrics, and observability capability
