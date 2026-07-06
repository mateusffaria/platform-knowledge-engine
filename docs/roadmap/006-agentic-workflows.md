# AEM-006 — Agentic Workflows

## Goal

Introduce specialized agents.

## Problem

A single large prompt is hard to test, debug and observe.

The system should decompose AI tasks into smaller responsibilities.

## Scope

- Job Analyzer
- Evidence Builder
- Reviewer
- Validator
- agent orchestration
- traceable execution

## Out of Scope

- full benchmark suite
- advanced UI
- multi-user workflows

## Architectural Decisions

### Specialized agents

Each agent should own one responsibility.

### Tools over direct access

Agents should access system capabilities through tools and ports, not by directly querying the database.

### Evidence-bounded generation

Agents must operate on Evidence Packs rather than unrestricted career data.

## Acceptance Criteria

- Job descriptions can be analyzed.
- Evidence Packs can be passed to agents.
- Agent output is traceable.
- Unsupported claims can be detected.

## Risks

- Agent orchestration may introduce unnecessary complexity.
- Prompts may become hard to maintain.
- Tool contracts need to be stable.

## Next Milestone

AEM-007 — Knowledge Products.
