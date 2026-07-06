export type SourceDocumentType = "markdown";

export interface SourceDocument {
  id: string;
  sourceType: SourceDocumentType;
  path: string;
  metadata: Record<string, unknown>;
  rawContent: string;
  ingestedAt: Date;
}

export type KnowledgeAssetType = "canonical-career-document";

export interface KnowledgeAsset {
  id: string;
  sourceDocumentId: string;
  assetType: KnowledgeAssetType;
  title: string;
  summary?: string;
  createdAt: Date;
}

export interface SourceReference {
  id: string;
  sourceDocumentId: string;
  section: string;
  locator: string;
  excerpt: string;
}

export interface EvidenceClaim {
  id: string;
  knowledgeAssetId: string;
  sourceReferenceId: string;
  claimType: "skill" | "experience" | "project" | "achievement";
  claimText: string;
}

export interface EvidenceBackedRecord {
  evidenceClaimIds: string[];
  sourceReferenceIds: string[];
}

export interface Skill extends EvidenceBackedRecord {
  id: string;
  knowledgeAssetId: string;
  name: string;
  category?: string;
}

export interface Experience extends EvidenceBackedRecord {
  id: string;
  knowledgeAssetId: string;
  role: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface Project extends EvidenceBackedRecord {
  id: string;
  knowledgeAssetId: string;
  name: string;
  description?: string;
  technologies: string[];
}

export interface Achievement extends EvidenceBackedRecord {
  id: string;
  knowledgeAssetId: string;
  title: string;
  description?: string;
}

export interface CanonicalCareerDocument {
  source: SourceDocument;
  asset: KnowledgeAsset;
  references: SourceReference[];
  evidenceClaims: EvidenceClaim[];
  skills: Skill[];
  experiences: Experience[];
  projects: Project[];
  achievements: Achievement[];
}

export type EvidenceBackedCareerRecord = Skill | Experience | Project | Achievement;

export function assertEvidenceBacked(record: EvidenceBackedRecord): void {
  if (record.evidenceClaimIds.length === 0 || record.sourceReferenceIds.length === 0) {
    throw new Error("Career records must include evidence claims and source references.");
  }
}

export function assertCanonicalCareerDocument(document: CanonicalCareerDocument): void {
  for (const record of [
    ...document.skills,
    ...document.experiences,
    ...document.projects,
    ...document.achievements
  ]) {
    assertEvidenceBacked(record);
  }
}
