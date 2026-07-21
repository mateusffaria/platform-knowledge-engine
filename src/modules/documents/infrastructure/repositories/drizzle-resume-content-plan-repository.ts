import { and, desc, eq, inArray } from "drizzle-orm"

import { ResumeContentPlanRepository } from "../../application/ports/resume-content-plan-repository.js"
import { parsePersistedResumeContentPlan } from "../../application/resume-content-plan-schema.js"
import { ResumeContentPlan } from "../../domain/model.js"
import { resumeContentPlans } from "../../../../shared/database/schema.js"

interface ResumePlanDatabase {
  select: (...args: any[]) => any
  insert: (...args: any[]) => any
}

export function hydrateResumeContentPlan(row: typeof resumeContentPlans.$inferSelect): ResumeContentPlan {
  return parsePersistedResumeContentPlan(row.resumePlan)
}

export class DrizzleResumeContentPlanRepository implements ResumeContentPlanRepository {
  constructor(private readonly db: ResumePlanDatabase) {}

  async findByPlanIdentity(planIdentity: string): Promise<ResumeContentPlan | undefined> {
    const rows = await this.db.select().from(resumeContentPlans).where(eq(resumeContentPlans.planIdentity, planIdentity)).limit(1)
    return rows[0] ? hydrateResumeContentPlan(rows[0]) : undefined
  }

  async findLatestCompatible(input: Parameters<ResumeContentPlanRepository["findLatestCompatible"]>[0]): Promise<ResumeContentPlan | undefined> {
    if (input.schemaVersions.length === 0) return undefined
    const rows = await this.db.select().from(resumeContentPlans)
      .where(and(
        eq(resumeContentPlans.jobDescriptionId, input.jobDescriptionId),
        eq(resumeContentPlans.language, input.language),
        eq(resumeContentPlans.length, input.length),
        inArray(resumeContentPlans.schemaVersion, [...input.schemaVersions])
      ))
      .orderBy(desc(resumeContentPlans.createdAt), desc(resumeContentPlans.id))
    for (const row of rows) {
      try { return hydrateResumeContentPlan(row) } catch { continue }
    }
    return undefined
  }

  async save(plan: ResumeContentPlan): Promise<ResumeContentPlan> {
    const rows = await this.db.insert(resumeContentPlans).values({
      id: plan.id,
      planIdentity: plan.planIdentity,
      schemaVersion: plan.schemaVersion,
      jobDescriptionId: plan.jobDescriptionId,
      curatedEvidencePackId: plan.curatedEvidencePackId,
      language: plan.language,
      length: plan.length,
      provider: plan.provider,
      model: plan.model,
      promptVersion: plan.promptVersion,
      resumePlan: plan as unknown as Record<string, unknown>,
      createdAt: plan.createdAt
    }).onConflictDoNothing({ target: resumeContentPlans.planIdentity }).returning()
    if (rows[0]) return hydrateResumeContentPlan(rows[0])
    const winner = await this.findByPlanIdentity(plan.planIdentity)
    if (!winner) throw new Error("Resume Content Plan identity conflict occurred without a stored winner.")
    return winner
  }
}
