# Agent Observability Specification

## Purpose
Defines the required behavior for the `agent-observability` capability.

## Requirements

### Requirement: Versioned Job Analyzer prompts
The system SHALL define the Job Analyzer prompt in a versioned application-owned prompt module, and every successful analysis snapshot MUST record the prompt version used to create it.

#### Scenario: Analysis prompt is executed
- **WHEN** the Job Analyzer prepares a provider request
- **THEN** it uses the versioned prompt contract and associates that version with the execution

#### Scenario: Analysis is persisted
- **WHEN** a valid analysis is persisted
- **THEN** the persisted snapshot records the exact prompt version and effective model used for that analysis

### Requirement: Observable LLM analysis lifecycle
The Job Analyzer orchestration SHALL use the existing observability port to trace each LLM analysis attempt, including safe job identifiers, provider, model, prompt version, completion outcome, and validation outcome. Traces MUST be flushed whether analysis succeeds or fails.

#### Scenario: Analysis succeeds
- **WHEN** an LLM response passes schema validation and is persisted
- **THEN** the trace records successful provider completion and validation before it is flushed

#### Scenario: Analysis fails validation
- **WHEN** an LLM response fails structured-output validation
- **THEN** the trace records the validation failure without treating the invalid output as a persisted analysis, and the trace is flushed

### Requirement: Observability does not change analysis behavior
The system SHALL preserve Job Analyzer behavior when Langfuse is disabled or the configured observability implementation is no-op.

#### Scenario: Langfuse is disabled
- **WHEN** `LANGFUSE_ENABLED` is false
- **THEN** analysis can still succeed or fail according to its provider and validation contracts without requiring an external observability service

