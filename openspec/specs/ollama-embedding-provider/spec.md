# Ollama Embedding Provider Specification

## Purpose
Defines the required behavior for the `ollama-embedding-provider` capability.

## Requirements

### Requirement: Configured Ollama provider selection

The system SHALL select an Ollama-backed embedding provider when semantic retrieval is configured with `EMBEDDING_PROVIDER=ollama`, `EMBEDDING_MODEL`, and `OLLAMA_BASE_URL`.

#### Scenario: Ollama provider is selected

- **WHEN** retrieval services are created with `EMBEDDING_PROVIDER=ollama`, `EMBEDDING_MODEL=nomic-embed-text`, and `OLLAMA_BASE_URL=http://localhost:11434`
- **THEN** indexing and search use an embedding provider that sends embedding requests to the configured Ollama base URL

#### Scenario: Unsupported provider is rejected

- **WHEN** retrieval services are created with an `EMBEDDING_PROVIDER` value other than `ollama`
- **THEN** the system fails with a clear error identifying the unsupported provider

### Requirement: Missing embedding provider configuration

The system SHALL fail with a specific actionable error when semantic retrieval is used without embedding provider configuration.

#### Scenario: Indexing without provider configuration

- **WHEN** `pke index` runs without `EMBEDDING_PROVIDER`
- **THEN** the command reports that an embedding provider is required and includes the Ollama environment variables needed to continue

#### Scenario: Searching without provider configuration

- **WHEN** `pke search "<query>"` runs without `EMBEDDING_PROVIDER`
- **THEN** the command reports that an embedding provider is required and includes the Ollama environment variables needed to continue

### Requirement: Ollama document embeddings

The Ollama embedding provider SHALL generate one embedding vector per document input using the configured Ollama model.

#### Scenario: Document embedding request succeeds

- **WHEN** the provider receives multiple document texts and Ollama returns one embedding for each text
- **THEN** the provider returns the same number of embedding vectors with provider `ollama`, the configured model, dimensions, and numeric values

#### Scenario: Document embedding count mismatch

- **WHEN** Ollama returns fewer or more embeddings than requested document texts
- **THEN** indexing fails before any mismatched embedding is persisted

### Requirement: Ollama query embeddings

The Ollama embedding provider SHALL generate a single embedding vector for semantic search queries using the configured Ollama model.

#### Scenario: Query embedding request succeeds

- **WHEN** `pke search "<query>"` runs with Ollama configured and Ollama returns an embedding
- **THEN** the search use case queries the vector store with an embedding vector whose provider is `ollama` and whose model is the configured model

### Requirement: Embedding dimension validation

The system SHALL reject provider embeddings whose dimensions do not match the configured vector storage dimensions before persistence or search.

#### Scenario: Index embedding has invalid dimensions

- **WHEN** Ollama returns a document embedding whose value count does not match the database embedding dimension
- **THEN** indexing fails before persisting the embedding

#### Scenario: Query embedding has invalid dimensions

- **WHEN** Ollama returns a query embedding whose value count does not match the database embedding dimension
- **THEN** search fails before querying the vector store

### Requirement: Ollama setup documentation

The system SHALL document the local Ollama setup required for semantic indexing and search.

#### Scenario: User follows setup documentation

- **WHEN** a user reads the retrieval setup documentation
- **THEN** the documentation explains how to configure `EMBEDDING_PROVIDER=ollama`, `EMBEDDING_MODEL=nomic-embed-text`, and `OLLAMA_BASE_URL=http://localhost:11434`

