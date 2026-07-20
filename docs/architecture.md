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
- evidence evaluation;
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
Candidate Evidence Pack
        ↓
Curated Evidence Pack
```

Evaluation executes the retrieval and jobs boundaries against immutable fixtures:

```text
Versioned Golden Dataset
        ↓
Read-only Fixture Pipeline
        ↓
Retrieval → Candidate Association → Reasoning
        ↓
Deterministic Stage Assertions
        ↓
Persisted Evaluation Run + Reports + Optional Telemetry
```

Job descriptions follow a separate retrieval-intent flow. They are external requirements, not candidate evidence:

```text
Job Source (.md, .markdown, .txt)
        ↓
Deterministic Job Parser
        ↓
Canonical Job Description + Job Requirements
        ↓
Job Store
        ↓
JobAnalyzerAgent (optional validated enrichment)
        ↓
Job Analysis snapshots + Job Retrieval Intent (deterministic PKQL filters + enriched semantic text)
        ↓
Hybrid Retrieval
        ↓
Evidence Pack
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

    evaluation/
      domain/
      application/
        use-cases/
        ports/
      infrastructure/
      interfaces/
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

It combines:

- structured retrieval from PostgreSQL;
- semantic retrieval from pgvector.

Retrieval owns embedding text generation, vector persistence, vector cleanup, query planning, structured and semantic retrieval orchestration, result merging, deduplication, ranking and Evidence Pack generation. It consumes eligibility decisions supplied by reconciliation instead of deciding trusted-knowledge policy itself.

Hybrid retrieval returns Evidence Packs rather than free-form text. Evidence Packs include the original query, strategies used, ranked Evidence Items, score components, provenance, source excerpts, generation timestamp and warnings. The final ranking score is used for ordering retrieval results and must not be treated as an objective probability of truth.

Retrieval application code talks to structured knowledge through a `StructuredKnowledgeSearch` port and to semantic indexes through embedding and vector-store ports. Production adapters may use PostgreSQL, pgvector and knowledge infrastructure, but those details stay outside retrieval use cases.

### Jobs

Responsible for storing job descriptions, deterministically extracting their requirements, and building retrieval intent.

Key concepts:

- JobDescription
- JobRequirement
- JobSourceLocation
- JobRetrievalIntent

Jobs owns external job-source provenance, normalized requirement signals, agent-produced job-analysis snapshots, semantic fallback text, and bounded evidence curation. It does not create `KnowledgeAsset` or `EvidenceClaim` records, rank evidence, select retrieval strategies, resolve truth conflicts, or change claim eligibility. The CLI composition layer passes a Job Retrieval Intent to retrieval's hybrid-search application contract, then passes the preselected result to jobs as a Candidate Evidence Pack.

The initial parser supports local Markdown and plain text. It detects common requirements, qualifications, responsibilities, and preferred sections, preserves source excerpts and line locations, and flags any inferred signals. Deterministic extraction remains the authority for explicit source text.

`JobAnalyzerAgent` is a bounded application service. It consumes only an already loaded canonical job through ports, invokes an `LlmProvider` port, validates its structured output, and persists immutable `JobAnalysis` snapshots separately from `JobDescription` and `JobRequirement`. Analysis requirements are always marked inferred. They can enrich semantic retrieval text but cannot alter deterministic PKQL filters or professional evidence. Provider HTTP access, database access, and Langfuse adaptation remain in infrastructure; prompt version, model, provider, and validation outcomes are observable through ports.

`LlmEvidenceReasoner` is a separately bounded application service. It receives only a versioned, claim-addressable Candidate Evidence Pack; it has no retrieval, repository, database, vector-store, search, or tool port. Provider output is referential JSON only and is schema-validated against the supplied requirements and evidence IDs. Jobs reconstructs canonical selections/rejections, deterministically deduplicates cross-requirement evidence, derives any display score from qualitative coverage, and persists immutable Curated Evidence Packs. Qualitative coverage is never proof of hiring fitness.

### Documents

Responsible for generating outputs from evidence.

Examples:

- evidence packs;
- resumes;
- cover letters;
- LinkedIn summaries;
- interview answers.

### Evaluation

Responsible for versioned golden fixtures, isolated pipeline execution, deterministic stage-scoped expectations, aggregate metrics, immutable run snapshots, reports, and evaluation commands. It consumes retrieval and jobs through application contracts and read-only adapters. It never owns or mutates canonical knowledge, claim lifecycle state, retrieval policy, or reasoning policy.

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

Initial text-generation and embedding-provider support uses Ollama behind explicit provider ports. Future providers may include OpenAI or other implementations without changing jobs or retrieval application contracts.

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
