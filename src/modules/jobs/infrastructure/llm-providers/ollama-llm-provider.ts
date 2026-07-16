import { LlmGenerationRequest, LlmGenerationResponse, LlmProvider, LlmProviderIdentity } from "../../application/ports/llm-provider.js";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

interface OllamaLlmProviderOptions {
  baseUrl: string;
  model: string;
  fetchImpl?: Fetch;
}

interface OllamaGenerateResponse {
  response?: unknown;
  model?: unknown;
}

export class OllamaLlmProvider implements LlmProvider {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetchImpl: Fetch;

  constructor({ baseUrl, model, fetchImpl = fetch }: OllamaLlmProviderOptions) {
    this.endpoint = `${baseUrl.replace(/\/+$/, "")}/api/generate`;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  resolveIdentity(model?: string): LlmProviderIdentity {
    return { provider: "ollama", model: model?.trim() || this.model };
  }

  async generate(request: LlmGenerationRequest): Promise<LlmGenerationResponse> {
    const { model } = this.resolveIdentity(request.model);
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        system: request.systemPrompt,
        prompt: request.userPrompt,
        format: request.responseFormat,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama LLM request failed with HTTP ${response.status}: ${await response.text()}`);
    }

    let body: OllamaGenerateResponse;
    try {
      body = await response.json() as OllamaGenerateResponse;
    } catch (error) {
      throw new Error("Ollama LLM response was not valid JSON.", { cause: error });
    }

    if (typeof body.response !== "string" || body.response.trim() === "") {
      throw new Error("Ollama LLM response did not include generated content.");
    }

    return {
      content: body.response,
      provider: "ollama",
      model: typeof body.model === "string" && body.model.trim() ? body.model : model
    };
  }
}
