export interface LlmGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  responseFormat: "json";
}

export interface LlmGenerationResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface LlmProviderIdentity {
  provider: string;
  model: string;
}

export interface LlmProvider {
  resolveIdentity(model?: string): LlmProviderIdentity;
  generate(request: LlmGenerationRequest): Promise<LlmGenerationResponse>;
}
