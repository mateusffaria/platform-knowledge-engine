## ADDED Requirements

### Requirement: Resume planning uses the latest compatible curated evidence
The system SHALL generate a Resume Content Plan from the latest persisted Curated Evidence Pack for the requested job that validates against the supported input schema. It MUST fail before LLM invocation when the job has no compatible persisted pack.

#### Scenario: Multiple compatible packs exist
- **WHEN** resume planning is requested for a job with multiple compatible Curated Evidence Packs
- **THEN** the system uses the pack with the greatest creation time, using its ID as a stable tie-breaker

#### Scenario: No compatible pack exists
- **WHEN** resume planning is requested for a job with no persisted Curated Evidence Pack that validates against the supported input schema
- **THEN** the command fails with an actionable error and does not invoke the LLM or persist a plan

### Requirement: Planner input is a closed evidence boundary
The Resume Content Planner SHALL receive only the selected and omitted decisions from the chosen Curated Evidence Pack plus allowlisted canonical presentation metadata needed to plan or later render the selected evidence. The planner MUST NOT receive or access repositories, pgvector, retrieval, external search, unrestricted tools, raw source documents, or unrelated canonical knowledge.

#### Scenario: Planner input is constructed
- **WHEN** the use case invokes the Resume Content Planner
- **THEN** its frozen input contains only the chosen pack, selected evidence, requirement coverage, omissions, and allowlisted identifiers, evidence text, provenance, metrics, technologies, organizations, roles, and dates for selected evidence

#### Scenario: Additional knowledge exists in storage
- **WHEN** canonical knowledge relevant to the job exists but is absent from the Curated Evidence Pack
- **THEN** the planner cannot retrieve, cite, or include that knowledge in the plan

#### Scenario: Curated evidence contains discarded candidates
- **WHEN** the Curated Evidence Pack records candidates rejected during evidence curation
- **THEN** their identifiers remain available only to deterministic validation and are not serialized into the LLM prompt

### Requirement: Resume plans have a structured traceable model
The system SHALL represent a Resume Content Plan as a strict structured aggregate containing `jobDescriptionId`, `curatedEvidencePackId`, `language`, `length`, professional summary, planned experiences, planned bullets, planned skill groups, selected evidence IDs, omitted evidence IDs with reasons, uncovered requirement IDs, warnings, provider, model, prompt version, and creation time. `PlannedBullet` MUST contain text, supporting evidence IDs, target requirement IDs, a source organization or experience ID, exaggeration risk, and warnings.

#### Scenario: Valid plan is produced
- **WHEN** a provider returns a complete schema-conforming planning response and all grounding checks pass
- **THEN** the system creates typed `PlannedSummary`, `PlannedExperience`, `PlannedBullet`, `PlannedSkillGroup`, and `OmittedEvidence` values within one Resume Content Plan

#### Scenario: Provider adds an unknown field or omits traceability
- **WHEN** the provider response contains an unknown field or a bullet lacks a required supporting evidence ID
- **THEN** strict schema validation rejects the response and no plan is persisted

#### Scenario: Evidence membership validation fails
- **WHEN** generated output references ineligible evidence
- **THEN** the diagnostic identifies the exact indexed output path and offending evidence ID without exposing professional content

### Requirement: LLM generation is schema-bound and prompt-versioned
The LLM-backed planner SHALL reuse the configured `LlmProvider`, request structured output through a JSON Schema derived from the strict plan schema, and record the resolved provider, model, and resume-planning prompt version. Prompts and input arrays MUST be built deterministically for the same command and input pack.

#### Scenario: A model override is supplied
- **WHEN** the user requests planning with `--model <model>`
- **THEN** provider identity is resolved for that model and the structured request, plan identity, persisted provenance, and telemetry use the resolved provider and model

#### Scenario: Provider emits malformed JSON
- **WHEN** the LLM response cannot be parsed against the strict schema after the bounded generation policy completes
- **THEN** planning fails with a sanitized structured-output diagnostic and persists no Resume Content Plan

#### Scenario: Evidence and requirement identifiers share the same storage format
- **WHEN** UUID-shaped evidence, requirement, and experience identifiers are supplied to the planner
- **THEN** the provider JSON Schema constrains each output field to the exact eligible identifier namespace derived from the planning input

#### Scenario: Skill-only evidence is available to the planner
- **WHEN** selected evidence contains skill-only claims alongside experience-capable claims
- **THEN** the provider JSON Schema permits skill-only IDs in summaries and skill groups but excludes them from planned-experience summaries and bullets, and experience source fields accept only experience-capable source IDs

### Requirement: Every factual statement is evidence-grounded
Every factual sentence in a planned summary, experience, bullet, or skill group SHALL reference at least one evidence ID selected by the Curated Evidence Pack. Every supporting and selected evidence ID MUST exist in that pack's recommended evidence, and discarded, rejected, superseded, `needs_review`, or otherwise unselected evidence MUST NOT be used.

#### Scenario: Every bullet cites selected evidence
- **WHEN** all bullet supporting IDs exist in the pack's recommended evidence and support their associated statements
- **THEN** evidence membership validation succeeds and the plan preserves those IDs for traceability

#### Scenario: Bullet cites an unknown evidence ID
- **WHEN** a bullet references an evidence ID absent from the selected evidence set
- **THEN** deterministic validation identifies the bullet and unknown ID, rejects the complete plan, and persists nothing

#### Scenario: Bullet cites discarded evidence
- **WHEN** a bullet references evidence recorded as discarded or rejected by the Curated Evidence Pack
- **THEN** deterministic validation rejects the complete plan even if that evidence exists elsewhere in canonical storage

### Requirement: Canonical facts are preserved exactly
The planner MAY rewrite wording but MUST NOT change factual meaning. Metrics, dates, organization names, role names, and technologies in factual output SHALL be supported by cited evidence and preserve their canonical values; the planner MUST NOT introduce an unsupported technology or other factual entity.

#### Scenario: Supported metric is copied
- **WHEN** a bullet cites evidence containing a 35% metric and renders that metric as `35%`
- **THEN** deterministic fact-preservation validation accepts the metric

#### Scenario: Metric is altered
- **WHEN** a bullet changes a cited source metric from 35% to 50%
- **THEN** deterministic validation reports altered metric evidence and rejects the complete plan

#### Scenario: Organization or role is changed
- **WHEN** a planned experience uses an organization or role value that does not match its cited canonical presentation metadata
- **THEN** deterministic validation rejects the complete plan

#### Scenario: Unsupported technology is introduced
- **WHEN** generated text names a technology absent from all evidence cited by that text and its allowlisted presentation metadata
- **THEN** deterministic validation identifies the unsupported technology and rejects the complete plan

### Requirement: Evidence strength and type constrain wording
The plan MUST preserve the ownership and exaggeration limits of its supporting evidence. Weak or contributory evidence MUST NOT be rewritten as sole or strong ownership, and skill-only evidence MUST NOT be represented as production experience or an achievement.

#### Scenario: Contributory evidence remains contributory
- **WHEN** selected evidence describes participation in a team outcome with elevated exaggeration risk
- **THEN** accepted wording preserves contributory language and the bullet carries the applicable exaggeration risk and warnings

#### Scenario: Skill evidence becomes an experience claim
- **WHEN** a generated experience or achievement is supported only by skill-category evidence
- **THEN** deterministic validation rejects the complete plan for unsupported evidence-type promotion

#### Scenario: Skill promotion accompanies a repairable accounting issue
- **WHEN** a first draft contains both a skill-to-experience promotion and a selection/omission accounting issue
- **THEN** the planner receives one bounded full-regeneration repair under the experience-capable evidence schema and the regenerated draft must pass every validation rule

### Requirement: Missing requirements remain explicit
Requirements that the Curated Evidence Pack marks missing or leaves uncovered MUST remain in the plan's uncovered requirements and MUST NOT be targeted or described as covered by generated content. Covered target requirement IDs MUST be supported by the bullet's cited evidence selections.

#### Scenario: Requirement has no selected evidence
- **WHEN** the Curated Evidence Pack marks Kubernetes as missing and selects no Kubernetes evidence
- **THEN** the plan lists that requirement as uncovered and contains no bullet or skill claim representing Kubernetes as covered

#### Scenario: Bullet targets an uncovered requirement
- **WHEN** a bullet targets a requirement that the Curated Evidence Pack marks missing or for which its cited evidence was not selected
- **THEN** deterministic validation rejects the complete plan

### Requirement: Selection and omission accounting is complete
The plan SHALL partition every recommended evidence ID from the Curated Evidence Pack into a used selected set or an `OmittedEvidence` entry with a reason. These sets MUST be duplicate-free and disjoint. Evidence MAY be omitted for relevance or length, and unsupported content MUST be omitted rather than invented.

#### Scenario: Relevant evidence is omitted for length
- **WHEN** a length bound prevents use of a recommended evidence item
- **THEN** the plan records its evidence ID once as omitted with a length reason and does not cite it in generated content

#### Scenario: Evidence is neither used nor omitted
- **WHEN** a recommended evidence ID is absent from both selected and omitted sets
- **THEN** deterministic validation rejects the plan as incomplete

#### Scenario: Evidence is both selected and omitted
- **WHEN** an evidence ID appears in generated content and in omitted evidence
- **THEN** deterministic validation rejects the plan as internally inconsistent

#### Scenario: First draft has only evidence membership or accounting issues
- **WHEN** the first schema-valid draft fails only deterministic evidence membership or selection/omission accounting rules
- **THEN** the planner receives one bounded repair request containing codes, indexed paths, code-specific resolutions, and only offending identifiers already allowlisted in the planner input, then regenerates a complete draft under a repair-specific schema that excludes an already-used evidence ID from `omittedEvidence`

#### Scenario: Repair issue contains an ineligible identifier
- **WHEN** an issue value is discarded, invented, or otherwise absent from the allowlisted planner input namespaces
- **THEN** the repair request omits that value while retaining its code and indexed path

#### Scenario: First draft mixes evidence and requirement identifier namespaces
- **WHEN** a first draft places requirement IDs in evidence fields or targets a requirement unsupported by the bullet's cited evidence
- **THEN** the issue paths identify the exact array entries and one bounded full regeneration may correct the reference relationships without weakening validation

#### Scenario: Regenerated draft remains invalid
- **WHEN** the bounded regenerated draft fails any deterministic rule
- **THEN** the system rejects it without silently deleting or rewriting entries and persists no Resume Content Plan

### Requirement: Requested languages are supported
The system SHALL support `pt-BR` and `en` planning and SHALL store the requested language on the plan. Deterministic locale validation MUST exempt canonical names, identifiers, metrics, and technology terms while rejecting content whose natural-language fields do not match the requested locale.

#### Scenario: Portuguese plan is requested
- **WHEN** planning is requested with `--language pt-BR` and the generated natural-language content passes Portuguese locale checks
- **THEN** the persisted plan records `pt-BR` and the CLI returns the Portuguese content without translating canonical values

#### Scenario: English content is returned for Portuguese request
- **WHEN** planning is requested with `--language pt-BR` but the generated natural-language fields deterministically match English instead
- **THEN** validation rejects the plan and persists nothing

### Requirement: Length profiles are bounded and distinct
The system SHALL support `concise`, `standard`, and `detailed` length profiles. Accepted plans MUST contain no more than 350 words and 4 bullets for concise, 650 words and 8 bullets for standard, or 1,000 words and 12 bullets for detailed; sparse evidence MUST result in shorter output rather than unsupported padding.

#### Scenario: Concise output exceeds its bound
- **WHEN** a concise response contains more than 350 normalized words or more than 4 planned bullets
- **THEN** deterministic validation rejects the plan and persists nothing

#### Scenario: Rich fixture is planned in concise and detailed modes
- **WHEN** the same sufficiently rich Curated Evidence Pack is successfully planned with concise and detailed profiles
- **THEN** both outputs respect their bounds and the detailed plan includes more supported content than the concise plan

#### Scenario: Evidence is sparse
- **WHEN** available selected evidence cannot safely fill the target detail for a requested profile
- **THEN** the accepted plan remains below the profile limit and records omissions or warnings instead of fabricating content

### Requirement: Resume plans are immutable and deterministically reused
The system SHALL persist a plan only after all validation succeeds. It MUST derive a unique plan identity from Curated Evidence Pack ID, resolved provider, resolved model, prompt version, language, and length, and MUST return the existing immutable plan for a repeated identical identity without invoking the provider again.

#### Scenario: Identical request is repeated
- **WHEN** a validated plan already exists for the same pack, provider, model, prompt version, language, and length
- **THEN** the system returns the existing plan with its original ID and creation time and does not invoke the LLM

#### Scenario: Version input changes
- **WHEN** the latest compatible pack, provider, model, prompt version, language, or length differs from a persisted plan identity
- **THEN** the system treats the request as a distinct plan and never mutates or overwrites the earlier plan

#### Scenario: Concurrent identical plans are persisted
- **WHEN** concurrent requests race to save the same unique plan identity
- **THEN** storage retains one immutable row and both requests return that stored plan

#### Scenario: Cached generation is explicitly bypassed
- **WHEN** the user supplies `--force` to resume planning, job analysis, or evidence reasoning
- **THEN** the system skips reuse, derives a fresh immutable generation identity, invokes the provider, persists the new validated snapshot alongside prior snapshots, and returns the new result

#### Scenario: Candidate or retrieval analysis is explicitly refreshed
- **WHEN** the user supplies `--force` to `jobs candidates` or `jobs retrieve`
- **THEN** the system regenerates and persists job analysis before rebuilding the retrieval intent and deterministic candidate or retrieval result

### Requirement: Documents CLI exposes resume planning
The CLI SHALL provide `pke documents resume plan <job-id>` with `--model`, `--language pt-BR|en`, `--length concise|standard|detailed`, `--json`, `--verbose`, and `--force`. Language SHALL default to `en`, length SHALL default to `standard`, and invalid option values MUST fail before planning begins.

#### Scenario: JSON output is requested
- **WHEN** a user runs `pke documents resume plan <job-id> --json`
- **THEN** stdout contains exactly one machine-readable validated Resume Content Plan and no preview or progress text

#### Scenario: Compact preview is requested implicitly
- **WHEN** a user runs the command without `--json`
- **THEN** the CLI prints a compact terminal preview derived from the validated plan

#### Scenario: Verbose preview is requested
- **WHEN** a user runs the command with `--verbose` and without `--json`
- **THEN** the preview additionally shows evidence traceability, omissions, uncovered requirements, warnings, and generation identity without prompts or raw provider responses

#### Scenario: Option value is invalid
- **WHEN** the user supplies an unsupported language or length value
- **THEN** the CLI returns a non-zero exit status and does not load evidence or invoke the provider

### Requirement: Planning observability is optional and privacy-safe
The system SHALL instrument input loading, reuse lookup, prompt construction, LLM inference, schema validation, deterministic validation, persistence, and final outcome through documents-specific OpenTelemetry and Langfuse adapters. Observability failures MUST NOT change planning results, and prompts, evidence, or generated content MUST NOT be captured unless explicit content capture is enabled.

#### Scenario: Metadata-only observability is enabled
- **WHEN** a plan is generated with telemetry enabled and content capture disabled
- **THEN** traces record safe identity, provider/model/prompt, language/length, timing, token usage when supplied, cache outcome, and validation outcome without professional or generated content

#### Scenario: Telemetry exporter fails
- **WHEN** trace, metric, log, or Langfuse export fails
- **THEN** the command completes with the same validated plan or application error it would have produced with no-op observability

#### Scenario: Cached plan is returned
- **WHEN** an identical persisted plan is reused
- **THEN** telemetry records a cache hit and no inference span or generation event is emitted

### Requirement: Golden evaluation detects unsafe resume content
The evaluation framework SHALL include immutable deterministic resume-planning scenarios for schema validity, evidence membership, discarded evidence, altered metrics, canonical organization/role/date preservation, unsupported technologies, skill-only inflation, uncovered-requirement fabrication, language, length, and reuse. These assertions MUST determine pass/fail without an LLM judge and MUST NOT mutate canonical knowledge.

#### Scenario: Fabricated evidence response is evaluated
- **WHEN** a controlled planner response cites an evidence ID absent from its Curated Evidence Pack fixture
- **THEN** the evaluation deterministically fails the grounding assertion and identifies the unsupported ID

#### Scenario: Metric mutation response is evaluated
- **WHEN** a controlled planner response alters a metric from its cited fixture evidence
- **THEN** the evaluation deterministically fails metric preservation and identifies the affected content path

#### Scenario: Valid bilingual and length scenarios run
- **WHEN** the golden resume-planning scenarios execute for English, Portuguese, concise, and detailed configurations
- **THEN** schema, locale, grounding, and bounded-size assertions produce stable results without changing canonical data

### Requirement: Resume planning architecture and operation are documented
The project SHALL document the Curated Evidence Pack to Resume Content Plan to renderer boundary, documents-module ownership and ports, plan schema and identity, deterministic validation rules, CLI usage, provider/model/prompt configuration, privacy-safe observability, golden evaluations, migrations, and the exclusion of rendering from this milestone.

#### Scenario: Developer implements a renderer
- **WHEN** a developer reads the architecture and documents-module documentation
- **THEN** they can identify the validated Resume Content Plan as renderer input without adding content generation or canonical knowledge access to the renderer

#### Scenario: Roadmap is reviewed
- **WHEN** AEM-010 roadmap documentation is read
- **THEN** its scope and acceptance criteria match evidence-grounded JSON content planning and do not claim PDF, DOCX, visual templates, or other out-of-scope generators
