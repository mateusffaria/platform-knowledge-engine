import { AppConfig } from "../../../../shared/config/env.js";
import { LlmProvider } from "../../application/ports/llm-provider.js";
import { MissingLlmProviderError, ollamaLlmSetupMessage } from "./missing-llm-provider-error.js";
import { OllamaLlmProvider } from "./ollama-llm-provider.js";

export class LlmProviderFactory {
  create(config: AppConfig): LlmProvider {
    const provider = config.llmProvider?.trim().toLowerCase();
    if (!provider) {
      throw new MissingLlmProviderError();
    }
    if (provider !== "ollama") {
      throw new Error(`Unsupported LLM provider "${config.llmProvider}". Supported providers: ollama.`);
    }
    if (!config.llmModel?.trim()) {
      throw new MissingLlmProviderError(`LLM_MODEL is required for Ollama generation. ${ollamaLlmSetupMessage}`);
    }

    return new OllamaLlmProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.llmModel
    });
  }
}
