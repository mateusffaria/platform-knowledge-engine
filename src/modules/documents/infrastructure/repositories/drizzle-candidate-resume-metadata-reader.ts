import { and, desc, inArray, or } from "drizzle-orm"

import { CandidateResumeMetadataReader } from "../../application/ports/candidate-resume-metadata-reader.js"
import { ResumeGenerationSource } from "../../application/generation-input.js"
import { CandidateLink, CandidateResumeEntry, CandidateResumeMetadata, ProvenancedText, ResumeSourceProvenance } from "../../domain/resume-document.js"
import { evidenceClaims, knowledgeAssets, sourceDocuments } from "../../../../shared/database/schema.js"

interface CandidateMetadataDatabase {
  select: (...args: any[]) => any
}

function metadataText(metadata: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

function provenanced(value: string | undefined, provenance: ResumeSourceProvenance[]): ProvenancedText | undefined {
  return value ? { value, provenance: provenance.map((item) => ({ ...item })) } : undefined
}

export class DrizzleCandidateResumeMetadataReader implements CandidateResumeMetadataReader {
  constructor(private readonly db: CandidateMetadataDatabase) {}

  async read(source: ResumeGenerationSource): Promise<CandidateResumeMetadata | undefined> {
    if (source.sourceDocumentIds.length === 0) return undefined
    const [documents, assets] = await Promise.all([
      this.db.select().from(sourceDocuments).where(inArray(sourceDocuments.id, source.sourceDocumentIds)).orderBy(desc(sourceDocuments.ingestedAt), desc(sourceDocuments.id)),
      this.db.select().from(knowledgeAssets).where(and(
        inArray(knowledgeAssets.sourceDocumentId, source.sourceDocumentIds),
        inArray(knowledgeAssets.assetType, ["professional_profile", "education", "certification"])
      ))
    ])
    const profileAssets = assets.filter((asset: typeof knowledgeAssets.$inferSelect) => asset.assetType === "professional_profile")
    const selectedDocument = documents.find((document: typeof sourceDocuments.$inferSelect) => profileAssets.some((asset: typeof knowledgeAssets.$inferSelect) => asset.sourceDocumentId === document.id))
    if (!selectedDocument) return undefined
    const profileAsset = profileAssets.filter((asset: typeof knowledgeAssets.$inferSelect) => asset.sourceDocumentId === selectedDocument.id)
      .sort((left: typeof knowledgeAssets.$inferSelect, right: typeof knowledgeAssets.$inferSelect) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id))[0]
    if (!profileAsset) return undefined
    const metadata = selectedDocument.metadata ?? {}
    const name = metadataText(metadata, "name", "candidateName") ?? profileAsset.title.trim()
    if (!name) return undefined
    const profileProvenance: ResumeSourceProvenance[] = [{ sourceDocumentId: selectedDocument.id, knowledgeAssetId: profileAsset.id }]
    const optionalAssets = assets.filter((asset: typeof knowledgeAssets.$inferSelect) => asset.sourceDocumentId === selectedDocument.id && (asset.assetType === "education" || asset.assetType === "certification"))
    const optionalAssetIds = optionalAssets.map((asset: typeof knowledgeAssets.$inferSelect) => asset.id)
    const claims = optionalAssetIds.length === 0 ? [] : await this.db.select().from(evidenceClaims).where(and(
      or(inArray(evidenceClaims.subjectAssetId, optionalAssetIds), inArray(evidenceClaims.knowledgeAssetId, optionalAssetIds)),
      inArray(evidenceClaims.status, ["confirmed", "single_source"])
    ))
    const claimsByAsset = new Map<string, Array<typeof evidenceClaims.$inferSelect>>()
    for (const claim of claims) {
      for (const id of [claim.subjectAssetId, claim.knowledgeAssetId]) {
        const values = claimsByAsset.get(id) ?? []
        values.push(claim)
        claimsByAsset.set(id, values)
      }
    }
    const entries = (type: "education" | "certification"): CandidateResumeEntry[] => optionalAssets
      .filter((asset: typeof knowledgeAssets.$inferSelect) => asset.assetType === type && (claimsByAsset.get(asset.id)?.length ?? 0) > 0)
      .sort((left: typeof knowledgeAssets.$inferSelect, right: typeof knowledgeAssets.$inferSelect) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
      .map((asset: typeof knowledgeAssets.$inferSelect) => {
        const provenance = (claimsByAsset.get(asset.id) ?? []).map((claim) => ({ sourceDocumentId: selectedDocument.id, sourceReferenceId: claim.sourceReferenceId, knowledgeAssetId: asset.id }))
        return { title: { value: asset.title, provenance }, ...(asset.summary ? { details: { value: asset.summary, provenance } } : {}) }
      })
    const linkValues: Array<[string, string | undefined]> = [
      ["LinkedIn", metadataText(metadata, "linkedin", "linkedIn")],
      ["GitHub", metadataText(metadata, "github", "gitHub")],
      ["Website", metadataText(metadata, "website", "url")]
    ]
    const links: CandidateLink[] = linkValues.flatMap(([label, value]) => value ? [{ label, value, provenance: profileProvenance }] : [])
    return {
      name: { value: name, provenance: profileProvenance },
      ...(provenanced(metadataText(metadata, "headline"), profileProvenance) ? { headline: provenanced(metadataText(metadata, "headline"), profileProvenance) } : {}),
      ...(provenanced(metadataText(metadata, "location"), profileProvenance) ? { location: provenanced(metadataText(metadata, "location"), profileProvenance) } : {}),
      ...(provenanced(metadataText(metadata, "email"), profileProvenance) ? { email: provenanced(metadataText(metadata, "email"), profileProvenance) } : {}),
      ...(provenanced(metadataText(metadata, "phone"), profileProvenance) ? { phone: provenanced(metadataText(metadata, "phone"), profileProvenance) } : {}),
      links,
      education: entries("education"),
      certifications: entries("certification"),
      profileSourceDocumentId: selectedDocument.id
    }
  }
}
