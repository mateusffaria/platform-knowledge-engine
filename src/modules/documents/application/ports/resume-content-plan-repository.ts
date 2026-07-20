import { ResumeContentPlan } from "../../domain/model.js"

export interface ResumeContentPlanRepository {
  findByPlanIdentity(planIdentity: string): Promise<ResumeContentPlan | undefined>
  save(plan: ResumeContentPlan): Promise<ResumeContentPlan>
}
