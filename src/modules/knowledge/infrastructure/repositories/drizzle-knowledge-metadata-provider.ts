import {
  KnowledgeMetadata,
  KnowledgeMetadataProvider
} from "../../../retrieval/application/ports/knowledge-metadata-provider.js";
import {
  experiences,
  projects,
  skills
} from "../../../../shared/database/schema.js";

interface KnowledgeMetadataDatabase {
  select: (...args: any[]) => any;
}

function uniqueDefined(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  )).sort((left, right) => left.localeCompare(right));
}

export class DrizzleKnowledgeMetadataProvider implements KnowledgeMetadataProvider {
  constructor(private readonly db: KnowledgeMetadataDatabase) {}

  async getMetadata(): Promise<KnowledgeMetadata> {
    const [skillRows, experienceRows, projectRows] = await Promise.all([
      this.db
        .select({
          name: skills.name
        })
        .from(skills),
      this.db
        .select({
          role: experiences.role,
          organization: experiences.organization
        })
        .from(experiences),
      this.db
        .select({
          name: projects.name,
          technologies: projects.technologies
        })
        .from(projects)
    ]);

    return {
      skills: uniqueDefined(skillRows.map((row: any) => row.name)),
      technologies: uniqueDefined(projectRows.flatMap((row: any) => row.technologies ?? [])),
      companies: uniqueDefined(experienceRows.map((row: any) => row.organization)),
      projects: uniqueDefined(projectRows.map((row: any) => row.name)),
      roles: uniqueDefined(experienceRows.map((row: any) => row.role))
    };
  }
}
