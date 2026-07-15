# AEM-006 — Agentic Workflows

## Goal

Introduce specialized agents.

## Problem

A single large prompt is hard to test, debug and observe.

The system should decompose AI tasks into smaller responsibilities.

## Delivered: Job Analyzer

The first specialized agent is `JobAnalyzerAgent`. It analyzes a persisted canonical job description and returns a Zod-validated, immutable `JobAnalysis` snapshot containing inferred requirements, seniority, domain, cross-team leadership, architecture/reliability signals, ambiguities, and warnings.

The agent receives only the canonical job source and deterministic extraction provenance. It has no direct access to repositories, PostgreSQL, pgvector, Ollama, professional EvidenceClaims, or conflict resolution. Inferred requirements remain separate from deterministic `JobRequirement` records, are marked `inferred: true`, and preserve source excerpts or locations where available.

Each analysis uses a versioned prompt and captures provider, model, prompt version, completion, and validation outcomes through the observability boundary. Invalid JSON or schema-invalid output is rejected before persistence and leaves the canonical job and previous analysis snapshots unchanged. Analysis can enrich semantic retrieval intent, but deterministic requirements retain control of PKQL filters and hybrid retrieval continues to return a traceable Evidence Pack.

## Broader Scope

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

Job Analyzer is the deliberate exception in input scope: it operates on an external job description, not candidate evidence, and must not generate or modify career claims.

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
