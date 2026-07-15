export const ollamaLlmSetupMessage = [
  "Configure LLM_PROVIDER=ollama, LLM_MODEL=<model>, and OLLAMA_BASE_URL=http://localhost:11434.",
  "Then make sure Ollama is running and the model has been pulled with: ollama pull <model>."
].join(" ");

export class MissingLlmProviderError extends Error {
  constructor(message = ollamaLlmSetupMessage) {
    super(message);
    this.name = "MissingLlmProviderError";
  }
}
