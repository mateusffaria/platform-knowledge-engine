# Llm Provider Specification

## Purpose
Defines the required behavior for the `llm-provider` capability.

## Requirements

### Requirement: Provider-independent structured generation
The system SHALL define an `LlmProvider` application port for structured text generation, and jobs application code MUST depend on that port rather than an Ollama SDK, HTTP client, or provider-specific response type.

#### Scenario: Job analyzer requests generation
- **WHEN** the Job Analyzer requires a structured analysis
- **THEN** it invokes the `LlmProvider` port with the versioned prompt, effective model, and structured-output expectation

#### Scenario: Provider is replaced
- **WHEN** a different LLM provider implementation is composed in the future
- **THEN** the Job Analyzer application contract remains unchanged

### Requirement: Ollama LLM provider
The system SHALL provide an `OllamaLlmProvider` infrastructure adapter that performs generation through the configured Ollama base URL and returns only the provider-port response contract.

#### Scenario: Ollama returns valid generated content
- **WHEN** Ollama responds successfully with generated content
- **THEN** the adapter returns that content and the effective provider/model metadata through the `LlmProvider` contract

#### Scenario: Ollama returns an unsuccessful response
- **WHEN** Ollama returns a non-success HTTP status or an invalid transport payload
- **THEN** the adapter fails with an actionable provider error and does not expose a partially parsed analysis

### Requirement: LLM configuration and composition
The production composition root SHALL select the LLM provider through `LLM_PROVIDER`, SHALL use `LLM_MODEL` as the configured model, and SHALL use `OLLAMA_BASE_URL` for the Ollama endpoint. The initial supported `LLM_PROVIDER` value MUST be `ollama`.

#### Scenario: Ollama configuration is complete
- **WHEN** `LLM_PROVIDER=ollama` and `LLM_MODEL` are configured
- **THEN** production jobs services compose an `OllamaLlmProvider` using `OLLAMA_BASE_URL`

#### Scenario: LLM configuration is incomplete or unsupported
- **WHEN** analysis is requested with a missing model, missing provider, or unsupported provider value
- **THEN** the command fails with setup guidance and does not call a provider or persist an analysis

#### Scenario: Command model override is supplied
- **WHEN** `pke jobs analyze` is invoked with `--model <model>`
- **THEN** that model is used for that analysis run and recorded with the resulting analysis

