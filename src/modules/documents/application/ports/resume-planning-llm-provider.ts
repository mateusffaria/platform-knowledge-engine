export interface ResumePlanningLlmRequest {
  systemPrompt: string
  userPrompt: string
  model?: string
  responseFormat: Record<string, unknown>
  disableThinking?: boolean
  maxPredict?: number
}

export interface ResumePlanningLlmResponse {
  content: string
  provider: string
  model: string
  usage?: { promptTokens?: number; completionTokens?: number }
  finishReason?: string
}

export interface ResumePlanningLlmProvider {
  resolveIdentity(model?: string): { provider: string; model: string }
  generate(request: ResumePlanningLlmRequest): Promise<ResumePlanningLlmResponse>
}
