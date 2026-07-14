export type SourceDocumentType = "markdown";

export interface SourceDocument {
  id: string;
  sourceType: SourceDocumentType;
  path: string;
  contentHash: string;
  sourceReliability: number;
  metadata: Record<string, unknown>;
  rawContent: string;
  ingestedAt: Date;
}

export type KnowledgeAssetType =
  | "canonical-career-document"
  | "professional_profile"
  | "organization"
  | "professional_experience"
  | "role"
  | "project"
  | "initiative"
  | "product"
  | "education"
  | "certification"
  | "skill";

export const professionalKnowledgeAssetTypes = new Set<KnowledgeAssetType>([
  "professional_profile",
  "organization",
  "professional_experience",
  "role",
  "project",
  "initiative",
  "product",
  "education",
  "certification",
  "skill"
]);

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
  sourceLanguage?: string;
  originalSectionLabel: string;
}

export type EvidenceClaimStatus = "confirmed" | "single_source" | "needs_review" | "rejected" | "superseded";
export type ConflictSeverity = "none" | "low" | "medium" | "high";
export type ClaimStatusTransitionSource = "system" | "user";
export type LegacyEvidenceClaimType = "skill" | "experience" | "project" | "achievement";
export type EvidenceClaimCategory =
  | "fact"
  | "responsibility"
  | "achievement"
  | "metric"
  | "capability"
  | "relationship";
export type EvidenceClaimPredicate =
  | "works_at"
  | "holds_role"
  | "uses_technology"
  | "participated_in"
  | "occurred_during"
  | "reduced_processing_time"
  | "reduced_cost"
  | "improved_reliability"
  | "demonstrates";

export interface EvidenceClaim {
  id: string;
  subjectAssetId: string;
  knowledgeAssetId: string;
  sourceReferenceId: string;
  claimType: LegacyEvidenceClaimType;
  claimCategory: EvidenceClaimCategory;
  predicate: EvidenceClaimPredicate;
  claimText: string;
  relatedAssetId?: string;
  valueText?: string;
  valueUnit?: string;
  sourceLanguage?: string;
  originalSectionLabel: string;
  status: EvidenceClaimStatus;
  confidenceScore: number;
  conflictSeverity: ConflictSeverity;
  reviewedAt?: Date;
  reviewReason?: string;
}

export interface ClaimStatusEvent {
  id: string;
  evidenceClaimId: string;
  previousStatus?: EvidenceClaimStatus;
  nextStatus: EvidenceClaimStatus;
  reason?: string;
  transitionSource: ClaimStatusTransitionSource;
  createdAt: Date;
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
  assets: KnowledgeAsset[];
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
  const assetIds = new Set(document.assets.map((asset) => asset.id));
  const sourceReferenceIds = new Set(document.references.map((reference) => reference.id));
  if (!assetIds.has(document.asset.id)) {
    throw new Error("Canonical career document asset must be included in the assets collection.");
  }

  for (const asset of document.assets) {
    if (!professionalKnowledgeAssetTypes.has(asset.assetType) && asset.assetType !== "canonical-career-document") {
      throw new Error(`Unsupported canonical knowledge asset type: ${asset.assetType}`);
    }
  }

  for (const claim of document.evidenceClaims) {
    if (!assetIds.has(claim.subjectAssetId) || !assetIds.has(claim.knowledgeAssetId)) {
      throw new Error("Evidence claims must reference known knowledge assets.");
    }
    if (!sourceReferenceIds.has(claim.sourceReferenceId)) {
      throw new Error("Evidence claims must reference known source references.");
    }
    if (claim.originalSectionLabel.trim().length === 0) {
      throw new Error("Evidence claims must preserve the original source section label.");
    }
  }

  for (const record of [
    ...document.skills,
    ...document.experiences,
    ...document.projects,
    ...document.achievements
  ]) {
    assertEvidenceBacked(record);
  }
}
