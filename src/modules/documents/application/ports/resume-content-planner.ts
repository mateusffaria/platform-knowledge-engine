import { ResumeLanguage, ResumeLength } from "../../domain/model.js"
import { ResumePlanningInput } from "../planning-input.js"
import { ResumePlanDraft } from "../resume-content-plan-schema.js"

export interface ResumePlanningIdentity {
  provider: string
  model: string
  promptVersion: string
  planIdentity: string
}

export interface ResumePlanningCommand {
  input: ResumePlanningInput
  language: ResumeLanguage
  length: ResumeLength
  model?: string
  repair?: ResumePlanningRepairFeedback
}

export interface ResumePlanningRepairFeedback {
  issues: readonly {
    code: string
    path: string
    value?: string
    resolution: string
  }[]
}

export interface ResumePlanningGeneration {
  draft: ResumePlanDraft
  provider: string
  model: string
  usage?: { promptTokens?: number; completionTokens?: number }
}

export interface ResumeContentPlanner {
  getIdentity(command: ResumePlanningCommand): ResumePlanningIdentity
  plan(command: ResumePlanningCommand): Promise<ResumePlanningGeneration>
}
