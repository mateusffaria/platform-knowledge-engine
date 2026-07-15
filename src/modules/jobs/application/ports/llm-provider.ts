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
}

export interface LlmProvider {
  generate(request: LlmGenerationRequest): Promise<LlmGenerationResponse>;
}
