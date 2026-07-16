import { and, desc, eq } from "drizzle-orm";

import { JobAnalysisRepository } from "../../application/ports/job-analysis-repository.js";
import { normalizeStoredJobAnalysisContent } from "../../application/job-analysis-schema.js";
import { JobAnalysis } from "../../domain/model.js";
import { jobAnalyses } from "../../../../shared/database/schema.js";

interface JobAnalysesDatabase {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
}

function toJobAnalysis(row: typeof jobAnalyses.$inferSelect): JobAnalysis {
  return {
    id: row.id,
    jobDescriptionId: row.jobDescriptionId,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    analysisIdentity: row.analysisIdentity ?? undefined,
    createdAt: row.createdAt,
    ...normalizeStoredJobAnalysisContent(row.analysis)
  };
}

export class DrizzleJobAnalysisRepository implements JobAnalysisRepository {
  constructor(private readonly db: JobAnalysesDatabase) {}

  async save(analysis: JobAnalysis): Promise<void> {
    const {
      id,
      jobDescriptionId,
      provider,
      model,
      promptVersion,
      analysisIdentity,
      createdAt,
      ...content
    } = analysis;
    await this.db.insert(jobAnalyses).values({
      id,
      jobDescriptionId,
      provider,
      model,
      promptVersion,
      analysisIdentity,
      analysis: content,
      createdAt
    });
  }

  async findLatestByJobDescriptionId(jobDescriptionId: string): Promise<JobAnalysis | undefined> {
    const rows = await this.db.select().from(jobAnalyses)
      .where(eq(jobAnalyses.jobDescriptionId, jobDescriptionId))
      .orderBy(desc(jobAnalyses.createdAt), desc(jobAnalyses.id))
      .limit(1);
    return rows[0] ? toJobAnalysis(rows[0]) : undefined;
  }

  async findByAnalysisIdentity(jobDescriptionId: string, analysisIdentity: string): Promise<JobAnalysis | undefined> {
    const rows = await this.db.select().from(jobAnalyses)
      .where(and(eq(jobAnalyses.jobDescriptionId, jobDescriptionId), eq(jobAnalyses.analysisIdentity, analysisIdentity)))
      .limit(1);
    return rows[0] ? toJobAnalysis(rows[0]) : undefined;
  }
}
