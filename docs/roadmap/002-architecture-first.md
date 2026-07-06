# AEM-002 — Architecture First

## Goal

Refactor the project into a Modular Monolith with Hexagonal Architecture.

## Problem

As the system grows, organizing code only by technical layer can create large generic folders such as `services`, `repositories` and `use-cases`.

The project needs boundaries based on business capabilities.

## Scope

- Modular Monolith structure
- capability-based modules
- Hexagonal Architecture inside modules
- ports and adapters
- explicit use cases
- dependency rules
- architecture documentation

## Target Modules

- ingestion
- knowledge
- retrieval
- jobs
- documents
- shared

## Dependency Rules

- Domain must not depend on infrastructure.
- Application may depend on domain and ports.
- Infrastructure implements ports.
- CLI calls application use cases only.
- Cross-module communication should happen through explicit application services or ports.

## Out of Scope

- new ingestion formats
- resume generation
- vector search implementation
- benchmarking
- HTTP API
- microservices

## Architectural Decision

Use a Modular Monolith because the project is local-first and does not need distributed deployment complexity.

Use Hexagonal Architecture because the system depends on replaceable external tools such as parsers, databases, LLM providers, embedding providers and observability platforms.

## Acceptance Criteria

- Existing behavior is preserved.
- CLI does not call infrastructure directly.
- Infrastructure adapters implement ports.
- Existing tests keep passing.
- Architecture is documented.

## Risks

- Too many interfaces can create accidental complexity.
- Modules that are too small may fragment the codebase.
- Hexagonal Architecture can become ceremony if applied without discipline.

## Next Milestone

AEM-003 — Semantic Knowledge.
