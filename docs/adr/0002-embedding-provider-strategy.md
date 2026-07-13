# Embedding Provider Strategy

## Status

Accepted

## Context

The Professional Knowledge Engine needs semantic retrieval over verified professional knowledge.

Semantic retrieval requires generating embeddings from deterministic text representations of KnowledgeAssets and EvidenceClaims.

The project should remain local-first and should not be coupled to a single commercial LLM provider.

## Decision

The project will use an `EmbeddingProvider` port and provider-specific infrastructure adapters.

The first concrete provider will be Ollama.

The application layer will depend only on the `EmbeddingProvider` port.

Provider selection will be handled by an `EmbeddingProviderFactory`, based on configuration.

## Rationale

Ollama aligns with the local-first nature of the project and allows semantic indexing without requiring an external API key.

Keeping embeddings behind a port allows the project to support additional providers later, such as OpenAI, without changing use cases.

## Architecture

```text
Configuration
      ↓
EmbeddingProviderFactory
      ↓
OllamaEmbeddingProvider
      ↓
Ollama API
```

## Configuration

### Example:

```
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434
```

## Consequences

### Positive:

- Preserves local-first architecture
- Avoids vendor lock-in
- Keeps use cases provider-agnostic
- Enables future benchmarking

### Negative:

- Requires Ollama to be installed locally
- Embedding quality depends on local model
- Local performance depends on machine resources

### Future Options

Future providers may include:

- OpenAI
- Voyage AI
- Gemini
- local sentence-transformer models
