import { ResumeContentPlan, ResumeLanguage, ResumeLength } from "../../domain/model.js"

export interface ResumeContentPlanRepository {
  findByPlanIdentity(planIdentity: string): Promise<ResumeContentPlan | undefined>
  findLatestCompatible(input: { jobDescriptionId: string; language: ResumeLanguage; length: ResumeLength; schemaVersions: readonly string[] }): Promise<ResumeContentPlan | undefined>
  save(plan: ResumeContentPlan): Promise<ResumeContentPlan>
}
