# Retrieval Module

The retrieval module owns indexing and retrieval of eligible professional evidence. It accesses career knowledge through application contracts and ports; retrieval application code must not import knowledge infrastructure, reconciliation infrastructure, database schemas, vector adapters, or provider SDKs directly.

## Responsibilities

- Build deterministic embedding text for indexable knowledge.
- Persist and search vectors through the `VectorStore` port.
- Plan retrieval queries with deterministic rules.
- Orchestrate structured and semantic retrieval.
- Merge, deduplicate, rank, and return Evidence Packs.

Retrieval does not own source ingestion, claim reconciliation, truth resolution, document generation, or LLM-based planning.

## Hybrid Retrieval

`pke retrieve "<query>"` runs the hybrid retrieval use case. It first parses PKQL (Professional Knowledge Query Language) filters into a Query AST, asks the metadata matcher for normalized `MetadataMatch` objects, and then the planner selects one or both strategies:

- `structured`: explicit PKQL filters and metadata matches from the current knowledge store.
- `semantic`: remaining natural-language or conceptual text.

Metadata matches are normalized before planning. They use canonical categories (`skill`, `technology`, `organization`, `role`, `project`, `product`, and `initiative`) and deterministic match types (`exact`, `prefix`, `partial`, and `alias`). Aliases and localized vocabulary belong to metadata matching, not to the planner.

PKQL supports `company`, `role`, `technology`, `skill`, `project`, `status`, `after`, `before`, and `type` filters. Quoted text values are normalized exact matches; unquoted text values are case-insensitive normalized prefixes. For example, `company:acme` matches `Acme Knowledge Systems`, while `company:"Acme Knowledge Systems"` targets that full canonical organization name.

Values with spaces must be quoted. For example:

- `pke retrieve "company:VTEX"`
- `pke retrieve "project:\"Professional Knowledge Engine\""`
- `pke retrieve "company:acme"`
- `pke retrieve "company:\"Acme Knowledge Systems\" observability"`
- `pke retrieve "company:VTEX distributed systems observability"`
- `pke retrieve "status:confirmed"`

When unquoted text follows a text filter, PKQL returns an advisory warning because the text may be part of a compound value. Quote the full value when that is intended. Mixed queries use both strategies in deterministic order. Explicit PKQL filters are candidate-set constraints even when metadata matches are also present: structured search produces the allowed evidence set, and semantic search ranks only embeddings in that set. Filter-only queries skip semantic embedding. The planner is rule-based and does not use an LLM. It consumes only the Query AST and `MetadataMatch[]`; it does not fetch metadata, inspect database metadata structures, or own hardcoded skill, technology, organization, role, project, product, initiative, stopword, or language dictionaries.

Structured retrieval is accessed through the `StructuredKnowledgeSearch` port. Semantic retrieval reuses the configured embedding provider and `VectorStore`.

## Evidence Packs

An Evidence Pack includes:

- original query;
- retrieval strategies used;
- ranked Evidence Items;
- generation timestamp;
- warnings, including empty-result limitations.

Each Evidence Item includes claim or asset identity, claim text, claim status when available, confidence score, structured score when available, semantic score when available, final score, retrieval strategies, source references, and excerpts.

Duplicate candidates are merged by evidence claim identity first, then by knowledge asset identity when a claim id is unavailable.

## Ranking

Ranking is deterministic. Confirmed claims receive a higher status boost than equivalent single-source claims, exact structured matches receive a configurable boost, semantic similarity contributes through a configurable weight, and stable identities break ties.

`finalScore` is a retrieval ranking score used for ordering Evidence Items. It is not an objective probability that a claim is true.

## Eligibility

Evidence Packs only include trusted retrieval output:

- `confirmed`
- `single_source`

Claims with `needs_review`, `rejected`, or `superseded` status remain auditable in the knowledge store but are excluded from Evidence Packs.
