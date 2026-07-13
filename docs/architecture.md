# Architecture

## Architectural Style

The project uses a Modular Monolith with Hexagonal Architecture inside each module.

This combines:

- the simplicity of a single local-first application;
- clear separation of business capabilities;
- explicit boundaries around external dependencies.

## Why Modular Monolith?

The system does not need microservices.

It is a local-first project with multiple capabilities that should remain independently understandable:

- ingestion;
- knowledge management;
- retrieval;
- job analysis;
- document generation;
- observability.

A modular monolith allows the project to keep one runtime and one deployment model while avoiding a disorganized monolith.

## Why Hexagonal Architecture?

The project depends on many external tools and providers:

- PostgreSQL;
- pgvector;
- Drizzle;
- Markdown/PDF/DOCX parsers;
- LLM providers;
- embedding providers;
- Langfuse;
- OpenTelemetry;
- document renderers.

Hexagonal Architecture protects the application core from these tools.

The domain and use cases define what the system does. Infrastructure adapters define how external tools are used.

## High-level Flow

```text
Knowledge Sources
        ↓
Ingestion Pipeline
        ↓
Canonical Career Model
        ↓
Knowledge Store
        ↓
Validation / Conflict Resolution
        ↓
Semantic Index
        ↓
Hybrid Retrieval
        ↓
Evidence Pack
        ↓
Agentic Document Generation
```

## Module Organization

Target structure:

```text
src/
  shared/
    config/
    database/
    logging/
    observability/

  modules/
    ingestion/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
      interfaces/

    knowledge/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/

    retrieval/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/

    jobs/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/

    documents/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
```

## Dependency Rules

The project should follow these rules:

```text
interfaces → application → domain
infrastructure → application/domain
domain → no external dependencies
```

Rules:

- Domain must not depend on infrastructure.
- Application may depend on domain and ports.
- Infrastructure implements application ports.
- CLI commands may call application use cases only.
- CLI commands must not call database clients, repositories, parsers, LLM providers or telemetry clients directly.
- Cross-module communication must happen through explicit application services or ports.

## Main Modules

### Ingestion

Responsible for transforming external professional sources into canonical internal representations.

Supported initially:

- Markdown

Future sources:

- PDF
- DOCX
- LinkedIn exports
- GitHub
- performance reviews
- personal notes

### Knowledge

Responsible for storing and managing professional knowledge identity and provenance.

Key concepts:

- SourceDocument
- KnowledgeAsset
- EvidenceClaim
- SourceReference
- Skill
- Experience
- Project
- Achievement

Knowledge owns `EvidenceClaim` identity, source references and persistence. It does not own claim assessment policy.

### Reconciliation

Responsible for trusted-knowledge assessment and review policy.

Key concepts:

- ClaimAssessment
- ClaimStatus
- Conflict
- ConflictSeverity
- ReconciliationResult

Reconciliation evaluates claims from knowledge through explicit application contracts, detects deterministic conflicts, manages review decisions and controls claim eligibility for trusted indexing and retrieval. It must not import knowledge repositories, Drizzle schemas, retrieval vector stores or provider adapters directly.

### Retrieval

Responsible for indexing and retrieving eligible evidence.

It will eventually combine:

- structured retrieval from PostgreSQL;
- semantic retrieval from pgvector.

Retrieval owns embedding text generation, vector persistence, vector cleanup and search mechanics. It consumes eligibility decisions supplied by reconciliation instead of deciding trusted-knowledge policy itself.

### Jobs

Responsible for parsing and analyzing job descriptions.

It will extract requirements, seniority signals, domain signals and relevant keywords.

### Documents

Responsible for generating outputs from evidence.

Examples:

- evidence packs;
- resumes;
- cover letters;
- LinkedIn summaries;
- interview answers.

## Data Strategy

PostgreSQL is the source of truth.

pgvector is used as an embedded semantic retrieval layer inside PostgreSQL.

This was chosen because the project requires both:

- relational consistency;
- semantic search.

Using PostgreSQL + pgvector keeps operational complexity low while preserving a migration path to dedicated vector stores such as Qdrant or Pinecone if needed.

## AI Strategy

The system should not be coupled to a single LLM provider.

LLM and embedding providers must be accessed through explicit ports.

Initial provider support may use OpenAI. Future support may include Ollama or other providers.

## Observability Strategy

The project separates two types of observability:

### Application observability

Used to understand system health:

- logs;
- errors;
- ingestion duration;
- database operations;
- command execution;
- latency.

### AI observability

Used to understand model behavior:

- prompts;
- traces;
- retrieved evidence;
- token usage;
- cost;
- latency;
- unsupported claims.

Langfuse can be used for AI traces. OpenTelemetry can be used for application traces.
