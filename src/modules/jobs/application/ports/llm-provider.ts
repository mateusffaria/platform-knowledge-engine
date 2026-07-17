export type LlmResponseFormat = "json" | Record<string, unknown>;

export interface LlmGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  responseFormat: LlmResponseFormat;
  /** Disable hidden reasoning for compact, schema-bound extraction tasks. */
  disableThinking?: boolean;
  /** A one-off completion budget override for a recovery attempt. */
  maxPredict?: number;
}

export interface LlmGenerationResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  finishReason?: string;
}

export interface LlmProviderIdentity {
  provider: string;
  model: string;
}

export interface LlmProvider {
  resolveIdentity(model?: string): LlmProviderIdentity;
  generate(request: LlmGenerationRequest): Promise<LlmGenerationResponse>;
}
