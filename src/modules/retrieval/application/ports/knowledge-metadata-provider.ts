import { MetadataCategory } from "../types.js";

export interface KnowledgeMetadataAlias {
  category: MetadataCategory;
  value: string;
  alias: string;
}

export interface KnowledgeMetadata {
  skills: string[];
  technologies: string[];
  organizations: string[];
  projects: string[];
  roles: string[];
  products: string[];
  initiatives: string[];
  aliases?: KnowledgeMetadataAlias[];
  companies?: string[];
}

export interface KnowledgeMetadataProvider {
  getMetadata(): Promise<KnowledgeMetadata>;
}
