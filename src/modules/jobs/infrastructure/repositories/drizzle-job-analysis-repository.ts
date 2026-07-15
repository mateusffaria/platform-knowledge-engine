import { desc, eq } from "drizzle-orm";

import { JobAnalysisRepository } from "../../application/ports/job-analysis-repository.js";
import { JobAnalysis, JobAnalysisContent } from "../../domain/model.js";
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
    createdAt: row.createdAt,
    ...(row.analysis as unknown as JobAnalysisContent)
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
      createdAt,
      ...content
    } = analysis;
    await this.db.insert(jobAnalyses).values({
      id,
      jobDescriptionId,
      provider,
      model,
      promptVersion,
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
}
