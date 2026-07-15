import { and, asc, eq } from "drizzle-orm";

import { JobDescriptionRepository } from "../../application/ports/job-description-repository.js";
import { JobDescription, JobDescriptionWithRequirements, JobRequirement } from "../../domain/model.js";
import { jobDescriptions, jobRequirements } from "../../../../shared/database/schema.js";

interface JobsDatabase {
  select: (...args: any[]) => any;
  transaction: <T>(handler: (tx: any) => Promise<T>) => Promise<T>;
}

function toJobDescription(row: typeof jobDescriptions.$inferSelect): JobDescription {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourcePath: row.sourcePath,
    rawContent: row.rawContent,
    contentHash: row.contentHash,
    title: row.title ?? undefined,
    ingestedAt: row.ingestedAt
  };
}

function toRequirement(row: typeof jobRequirements.$inferSelect): JobRequirement {
  return {
    id: row.id,
    jobDescriptionId: row.jobDescriptionId,
    requirementType: row.requirementType,
    importance: row.importance,
    normalizedValue: row.normalizedValue ?? undefined,
    originalText: row.originalText,
    sourceExcerpt: row.sourceExcerpt,
    sourceLocation: { startLine: row.sourceStartLine, endLine: row.sourceEndLine },
    sectionLabel: row.sectionLabel ?? undefined,
    inferred: row.inferred
  };
}

export class DrizzleJobDescriptionRepository implements JobDescriptionRepository {
  constructor(private readonly db: JobsDatabase) {}

  async hasJobDescriptionVersion(identity: { sourcePath: string; contentHash: string }): Promise<boolean> {
    const rows = await this.db.select({ id: jobDescriptions.id }).from(jobDescriptions)
      .where(and(eq(jobDescriptions.sourcePath, identity.sourcePath), eq(jobDescriptions.contentHash, identity.contentHash))).limit(1);
    return rows.length > 0;
  }

  async save(jobDescription: JobDescriptionWithRequirements): Promise<void> {
    await this.db.transaction(async (tx) => {
      const inserted = await tx.insert(jobDescriptions).values(jobDescription.job)
        .onConflictDoNothing({ target: [jobDescriptions.sourcePath, jobDescriptions.contentHash] })
        .returning({ id: jobDescriptions.id });
      if (inserted.length === 0 || jobDescription.requirements.length === 0) {
        return;
      }
      await tx.insert(jobRequirements).values(jobDescription.requirements.map((requirement) => ({
        id: requirement.id,
        jobDescriptionId: requirement.jobDescriptionId,
        requirementType: requirement.requirementType,
        importance: requirement.importance,
        normalizedValue: requirement.normalizedValue,
        originalText: requirement.originalText,
        sourceExcerpt: requirement.sourceExcerpt,
        sourceStartLine: requirement.sourceLocation.startLine,
        sourceEndLine: requirement.sourceLocation.endLine,
        sectionLabel: requirement.sectionLabel,
        inferred: requirement.inferred
      })));
    });
  }

  async findById(jobDescriptionId: string): Promise<JobDescriptionWithRequirements | undefined> {
    const jobs = await this.db.select().from(jobDescriptions).where(eq(jobDescriptions.id, jobDescriptionId)).limit(1);
    const job = jobs[0];
    if (!job) {
      return undefined;
    }
    const requirements = await this.db.select().from(jobRequirements)
      .where(eq(jobRequirements.jobDescriptionId, jobDescriptionId))
      .orderBy(asc(jobRequirements.sourceStartLine), asc(jobRequirements.id));
    return { job: toJobDescription(job), requirements: requirements.map(toRequirement) };
  }

  async list(): Promise<JobDescription[]> {
    const jobs = await this.db.select().from(jobDescriptions).orderBy(asc(jobDescriptions.ingestedAt), asc(jobDescriptions.id));
    return jobs.map(toJobDescription);
  }
}
