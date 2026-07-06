# Engineering Principles

## 1. Evidence before generation

Generated outputs must be grounded in evidence.

The system should not allow LLMs to create unsupported career facts. Every relevant claim used in a generated artifact should be traceable back to one or more evidence sources.

## 2. Source of truth over prompts

The source of truth is the Professional Knowledge Store, not a prompt.

Prompts may request transformations, summaries and composition, but they must not become the only place where facts exist.

## 3. Structured first, semantic second

The system should preserve structured knowledge before creating embeddings.

Semantic retrieval is useful, but it should complement structured retrieval rather than replace it.

## 4. Vector search is a retrieval mechanism

The vector index is not the source of truth.

The source of truth is the structured knowledge model stored in PostgreSQL. pgvector is used to improve semantic retrieval over already modeled and validated knowledge.

## 5. Local-first by default

The system should be easy to run locally with minimal operational overhead.

This helps the project remain understandable, reproducible and suitable for personal experimentation.

## 6. Replaceable providers

External providers must be replaceable behind explicit ports.

Examples:

- LLM providers
- Embedding providers
- Source parsers
- Vector stores
- Observability tools
- Document renderers

## 7. Modular boundaries matter

The project should be organized around business capabilities, not technical layers.

Modules should expose application-level behavior and hide infrastructure details.

## 8. Observability by design

AI systems are difficult to reason about without traces and metrics.

The project should observe both:

- application behavior;
- AI behavior.

Application observability includes logs, errors, latency, database operations and ingestion status.

AI observability includes prompts, model usage, token count, cost, latency, retrieved evidence and generated outputs.

## 9. Avoid premature complexity

The project should evolve through small, complete capabilities.

Do not introduce agents, benchmarking, dashboards or document generation before the knowledge foundation is reliable.

## 10. Document decisions when they matter

Documentation should explain why decisions were made, not merely describe what the code does.

Architecture decisions should be documented when they introduce meaningful trade-offs.
