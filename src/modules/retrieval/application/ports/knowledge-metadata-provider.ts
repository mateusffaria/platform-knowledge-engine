export interface KnowledgeMetadata {
  skills: string[];
  technologies: string[];
  companies: string[];
  projects: string[];
  roles: string[];
}

export interface KnowledgeMetadataProvider {
  getMetadata(): Promise<KnowledgeMetadata>;
}
