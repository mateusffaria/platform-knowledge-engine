# Roadmap

The project evolves through Architecture Evolution Milestones.

Each milestone introduces one architectural capability while keeping the system functional.

## AEM-001 — Foundation

Build the technical foundation:

- CLI
- PostgreSQL
- pgvector
- Drizzle
- Docker Compose
- Markdown ingestion
- Canonical Career Model
- persistence
- basic observability hooks

Status: started / partially implemented.

## AEM-002 — Architecture First

Refactor the project into a Modular Monolith with Hexagonal Architecture.

Capabilities:

- business-capability modules;
- ports and adapters;
- use cases;
- dependency rules;
- architecture documentation.

Status: in progress.

## AEM-003 — Semantic Knowledge

Create the semantic indexing foundation.

Capabilities:

- deterministic embedding text builder;
- embedding provider port;
- vector store port;
- pgvector adapter;
- index command;
- semantic search command.

## AEM-004 — Trusted Knowledge

Introduce evidence validation and conflict resolution.

Capabilities:

- confidence score;
- source ranking;
- claim status;
- review workflow;
- knowledge diff.

## AEM-005 — Hybrid Intelligence

Combine structured retrieval and semantic retrieval.

Capabilities:

- query planning;
- SQL retrieval;
- vector retrieval;
- result merging;
- evidence ranking;
- evidence pack creation.

## AEM-006 — Agentic Workflows

Introduce specialized agents.

Capabilities:

- job analyzer;
- evidence builder;
- reviewer;
- validator.

## AEM-007 — Knowledge Products

Generate professional artifacts from evidence.

Capabilities:

- job-specific resume;
- cover letter;
- LinkedIn update;
- interview answers.

## AEM-008 — AI Observability

Add first-class AI observability.

Capabilities:

- Langfuse integration;
- prompt tracing;
- token usage;
- cost tracking;
- latency tracking;
- trace correlation with application logs.

## AEM-009 — AI Evaluation

Evaluate output quality.

Capabilities:

- golden dataset;
- regression tests;
- hallucination checks;
- unsupported claim detection;
- ATS-style score.

## AEM-010 — Intelligence Benchmarking

Benchmark LLM providers.

Capabilities:

- multi-provider execution;
- cost comparison;
- latency comparison;
- quality comparison;
- output comparison charts.
