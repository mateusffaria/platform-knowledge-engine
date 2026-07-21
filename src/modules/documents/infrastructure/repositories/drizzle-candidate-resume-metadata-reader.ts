import { desc, inArray } from "drizzle-orm"

import { CandidateResumeMetadataReader } from "../../application/ports/candidate-resume-metadata-reader.js"
import { ResumeGenerationSource } from "../../application/generation-input.js"
import { CandidateLink, CandidateResumeMetadata, ProvenancedText, ResumeSourceProvenance } from "../../domain/resume-document.js"
import { readProfessionalProfileV1Metadata } from "../../../knowledge/domain/professional-profile.js"
import { knowledgeAssets, sourceDocuments } from "../../../../shared/database/schema.js"

interface CandidateMetadataDatabase {
  select: (...args: any[]) => any
}

function provenanced(value: string | undefined, provenance: ResumeSourceProvenance[]): ProvenancedText | undefined {
  return value ? { value, provenance: provenance.map((item) => ({ ...item })) } : undefined
}

export class DrizzleCandidateResumeMetadataReader implements CandidateResumeMetadataReader {
  constructor(private readonly db: CandidateMetadataDatabase) {}

  async read(source: ResumeGenerationSource): Promise<CandidateResumeMetadata> {
    if (source.sourceDocumentIds.length === 0) return { links: [] }
    const [documents, assets] = await Promise.all([
      this.db.select().from(sourceDocuments).where(inArray(sourceDocuments.id, source.sourceDocumentIds)).orderBy(desc(sourceDocuments.ingestedAt), desc(sourceDocuments.id)),
      this.db.select().from(knowledgeAssets).where(inArray(knowledgeAssets.sourceDocumentId, source.sourceDocumentIds))
    ])
    const profileAssets = assets.filter((asset: typeof knowledgeAssets.$inferSelect) => asset.assetType === "professional_profile")
    const selectedDocument = documents.find((document: typeof sourceDocuments.$inferSelect) => profileAssets.some((asset: typeof knowledgeAssets.$inferSelect) => asset.sourceDocumentId === document.id) && readProfessionalProfileV1Metadata(document.metadata?.professionalProfile))
    if (!selectedDocument) return { links: [] }
    const profileAsset = profileAssets.filter((asset: typeof knowledgeAssets.$inferSelect) => asset.sourceDocumentId === selectedDocument.id)
      .sort((left: typeof knowledgeAssets.$inferSelect, right: typeof knowledgeAssets.$inferSelect) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id))[0]
    const metadata = readProfessionalProfileV1Metadata(selectedDocument.metadata?.professionalProfile)
    if (!profileAsset || !metadata) return { links: [] }
    const candidate = metadata.candidate
    const profileProvenance: ResumeSourceProvenance[] = [{ sourceDocumentId: selectedDocument.id, knowledgeAssetId: profileAsset.id }]
    const linkValues: Array<[string, string | undefined]> = [
      ["LinkedIn", candidate.linkedin],
      ["GitHub", candidate.github],
      ["Website", candidate.website]
    ]
    const links: CandidateLink[] = linkValues.flatMap(([label, value]) => value ? [{ label, value, provenance: profileProvenance }] : [])
    return {
      name: { value: candidate.name, provenance: profileProvenance },
      ...(provenanced(candidate.headline, profileProvenance) ? { headline: provenanced(candidate.headline, profileProvenance) } : {}),
      ...(provenanced(candidate.location, profileProvenance) ? { location: provenanced(candidate.location, profileProvenance) } : {}),
      ...(provenanced(candidate.email, profileProvenance) ? { email: provenanced(candidate.email, profileProvenance) } : {}),
      ...(provenanced(candidate.phone, profileProvenance) ? { phone: provenanced(candidate.phone, profileProvenance) } : {}),
      links,
      profileSourceDocumentId: selectedDocument.id,
      profileKnowledgeAssetId: profileAsset.id
    }
  }
}
