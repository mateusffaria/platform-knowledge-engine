import { EmbeddingProvider } from "../ports/embedding-provider.js";
import { KnowledgeMetadataProvider } from "../ports/knowledge-metadata-provider.js";
import { StructuredKnowledgeSearch } from "../ports/structured-knowledge-search.js";
import { VectorStore } from "../ports/vector-store.js";
import { QueryPlanner } from "../query-planner.js";
import {
  defaultRankingConfig,
  EvidenceClaimCategory,
  EvidenceClaimPredicate,
  EvidenceClaimStatus,
  EvidenceClaimType,
  EvidenceItem,
  EvidencePack,
  EvidenceSourceReference,
  HybridSearchCandidate,
  HybridSearchInput,
  HybridSubjectType,
  RankingConfig,
  RetrievalStrategy,
  SearchResult
} from "../types.js";

export interface HybridSearchDependencies {
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;
  structuredKnowledgeSearch: StructuredKnowledgeSearch;
  knowledgeMetadataProvider?: KnowledgeMetadataProvider;
  queryPlanner?: QueryPlanner;
  rankingConfig?: Partial<RankingConfig>;
  now?: () => Date;
}

const eligibleClaimStatuses = new Set<EvidenceClaimStatus>(["confirmed", "single_source"]);
const claimStatuses = new Set<EvidenceClaimStatus>([
  "confirmed",
  "single_source",
  "needs_review",
  "rejected",
  "superseded"
]);
const claimTypes = new Set<EvidenceClaimType>(["skill", "experience", "project", "achievement"]);
const claimCategories = new Set<EvidenceClaimCategory>([
  "fact",
  "responsibility",
  "achievement",
  "metric",
  "capability",
  "relationship"
]);
const claimPredicates = new Set<EvidenceClaimPredicate>([
  "works_at",
  "holds_role",
  "uses_technology",
  "participated_in",
  "occurred_during",
  "reduced_processing_time",
  "reduced_cost",
  "improved_reliability",
  "demonstrates"
]);
const subjectTypes = new Set<HybridSubjectType>([
  "knowledge_asset",
  "evidence_claim",
  "skill",
  "experience",
  "project",
  "achievement"
]);

function parsePositiveInteger(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return resolved;
}

function parseOptionalScore(value: number | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  return value;
}

function validateClaimStatus(value: EvidenceClaimStatus | undefined): void {
  if (value === undefined) {
    return;
  }

  if (!claimStatuses.has(value)) {
    throw new Error(`Unsupported claim status filter: ${value}.`);
  }

  if (!eligibleClaimStatuses.has(value)) {
    throw new Error("Claim status filter must be confirmed or single_source for trusted retrieval.");
  }
}

function validateSubjectType(value: HybridSubjectType | undefined): void {
  if (value !== undefined && !subjectTypes.has(value)) {
    throw new Error(`Unsupported subject type filter: ${value}.`);
  }
}

function parseEmbeddingText(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length > 0 && value.length > 0) {
      fields[key] = value;
    }
  }

  return fields;
}

function parseClaimStatus(value: string | undefined): EvidenceClaimStatus | undefined {
  return value && claimStatuses.has(value as EvidenceClaimStatus)
    ? value as EvidenceClaimStatus
    : undefined;
}

function parseClaimType(value: string | undefined): EvidenceClaimType | undefined {
  return value && claimTypes.has(value as EvidenceClaimType)
    ? value as EvidenceClaimType
    : undefined;
}

function parseClaimCategory(value: string | undefined): EvidenceClaimCategory | undefined {
  return value && claimCategories.has(value as EvidenceClaimCategory)
    ? value as EvidenceClaimCategory
    : undefined;
}

function parsePredicate(value: string | undefined): EvidenceClaimPredicate | undefined {
  return value && claimPredicates.has(value as EvidenceClaimPredicate)
    ? value as EvidenceClaimPredicate
    : undefined;
}

function parseConfidenceScore(value: string | undefined): number {
  if (value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceFromSemanticResult(result: SearchResult, fields: Record<string, string>): EvidenceSourceReference[] {
  if (!result.sourceReferenceId) {
    return [];
  }

  return [{
    id: result.sourceReferenceId,
    sourceDocumentId: result.sourceDocumentId,
    section: fields.source_section,
    locator: fields.source_locator,
    excerpt: fields.source_excerpt ?? fields.claim_text ?? result.text,
    sourcePath: fields.source_path,
    sourceLanguage: fields.source_language,
    originalSectionLabel: fields.original_section_label
  }];
}

function semanticCandidateFromResult(result: SearchResult): HybridSearchCandidate {
  const fields = parseEmbeddingText(result.text);
  const claimText = fields.claim_text ?? fields.title ?? fields.summary ?? result.text;
  const claimType = parseClaimType(fields.claim_type);

  return {
    evidenceClaimId: result.evidenceClaimId,
    knowledgeAssetId: result.knowledgeAssetId,
    subjectAssetId: fields.subject_asset_id,
    subjectType: claimType ?? result.subjectType,
    claimType,
    claimCategory: parseClaimCategory(fields.claim_category),
    predicate: parsePredicate(fields.predicate),
    claimText,
    relatedAssetId: fields.related_asset_id,
    valueText: fields.value_text,
    valueUnit: fields.value_unit,
    claimStatus: parseClaimStatus(fields.claim_status),
    confidenceScore: parseConfidenceScore(fields.confidence_score),
    semanticScore: result.similarityScore,
    sources: sourceFromSemanticResult(result, fields),
    retrievalStrategies: ["semantic"]
  };
}

function candidateKey(candidate: HybridSearchCandidate): string {
  return candidate.evidenceClaimId
    ? `claim:${candidate.evidenceClaimId}`
    : `asset:${candidate.knowledgeAssetId}`;
}

function scoreOrZero(value: number | undefined): number {
  return value ?? 0;
}

function betterClaimStatus(
  current: EvidenceClaimStatus | undefined,
  next: EvidenceClaimStatus | undefined
): EvidenceClaimStatus | undefined {
  if (current === "confirmed" || next === undefined) {
    return current;
  }

  if (next === "confirmed") {
    return next;
  }

  return current ?? next;
}

function mergeSources(
  current: EvidenceSourceReference[],
  next: EvidenceSourceReference[]
): EvidenceSourceReference[] {
  const seen = new Set<string>();
  const merged: EvidenceSourceReference[] = [];
  for (const source of [...current, ...next]) {
    const key = `${source.id}:${source.sourceDocumentId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(source);
  }

  return merged;
}

function mergeStrategies(
  current: RetrievalStrategy[],
  next: RetrievalStrategy[]
): RetrievalStrategy[] {
  return (["structured", "semantic"] as const)
    .filter((strategy) => current.includes(strategy) || next.includes(strategy));
}

function mergeCandidate(
  current: HybridSearchCandidate,
  next: HybridSearchCandidate
): HybridSearchCandidate {
  return {
    evidenceClaimId: current.evidenceClaimId ?? next.evidenceClaimId,
    knowledgeAssetId: current.knowledgeAssetId,
    subjectAssetId: current.subjectAssetId ?? next.subjectAssetId,
    subjectType: current.subjectType === "knowledge_asset" ? next.subjectType : current.subjectType,
    claimType: current.claimType ?? next.claimType,
    claimCategory: current.claimCategory ?? next.claimCategory,
    predicate: current.predicate ?? next.predicate,
    claimText: current.claimText || next.claimText,
    relatedAssetId: current.relatedAssetId ?? next.relatedAssetId,
    valueText: current.valueText ?? next.valueText,
    valueUnit: current.valueUnit ?? next.valueUnit,
    claimStatus: betterClaimStatus(current.claimStatus, next.claimStatus),
    confidenceScore: Math.max(current.confidenceScore, next.confidenceScore),
    semanticScore: Math.max(scoreOrZero(current.semanticScore), scoreOrZero(next.semanticScore)) || undefined,
    structuredScore: Math.max(scoreOrZero(current.structuredScore), scoreOrZero(next.structuredScore)) || undefined,
    sources: mergeSources(current.sources, next.sources),
    retrievalStrategies: mergeStrategies(current.retrievalStrategies, next.retrievalStrategies)
  };
}

function isEligibleCandidate(candidate: HybridSearchCandidate): boolean {
  return candidate.claimStatus === undefined || eligibleClaimStatuses.has(candidate.claimStatus);
}

function calculateFinalScore(candidate: HybridSearchCandidate, config: RankingConfig): number {
  const statusBoost = candidate.claimStatus === "confirmed"
    ? config.confirmedStatusBoost
    : candidate.claimStatus === "single_source"
      ? config.singleSourceStatusBoost
      : 0;
  const structured = scoreOrZero(candidate.structuredScore) * config.structuredScoreWeight;
  const semantic = scoreOrZero(candidate.semanticScore) * config.semanticScoreWeight;
  const confidence = Math.max(0, Math.min(candidate.confidenceScore, 100)) / 100 * config.confidenceScoreWeight;
  const exactStructured = scoreOrZero(candidate.structuredScore) >= 1
    ? config.exactStructuredMatchBoost
    : 0;

  return Number((statusBoost + structured + semantic + confidence + exactStructured).toFixed(6));
}

function itemFromCandidate(candidate: HybridSearchCandidate, config: RankingConfig): EvidenceItem {
  return {
    evidenceClaimId: candidate.evidenceClaimId,
    knowledgeAssetId: candidate.knowledgeAssetId,
    subjectAssetId: candidate.subjectAssetId,
    subjectType: candidate.subjectType,
    claimType: candidate.claimType,
    claimCategory: candidate.claimCategory,
    predicate: candidate.predicate,
    claimText: candidate.claimText,
    relatedAssetId: candidate.relatedAssetId,
    valueText: candidate.valueText,
    valueUnit: candidate.valueUnit,
    claimStatus: candidate.claimStatus,
    confidenceScore: candidate.confidenceScore,
    semanticScore: candidate.semanticScore,
    structuredScore: candidate.structuredScore,
    finalScore: calculateFinalScore(candidate, config),
    sources: candidate.sources,
    retrievalStrategies: candidate.retrievalStrategies
  };
}

function stableIdentity(item: EvidenceItem): string {
  return item.evidenceClaimId ?? item.knowledgeAssetId;
}

export function createHybridSearchUseCase({
  embeddingProvider,
  vectorStore,
  structuredKnowledgeSearch,
  knowledgeMetadataProvider,
  queryPlanner,
  rankingConfig,
  now = () => new Date()
}: HybridSearchDependencies) {
  if (!queryPlanner && !knowledgeMetadataProvider) {
    throw new Error("Hybrid search requires a query planner or knowledge metadata provider.");
  }

  const planner = queryPlanner ?? new QueryPlanner(knowledgeMetadataProvider!);
  const config = {
    ...defaultRankingConfig,
    ...rankingConfig
  };

  return {
    async execute(input: HybridSearchInput): Promise<EvidencePack> {
      const plan = await planner.plan(input.query);
      const limit = parsePositiveInteger(input.limit, 10, "Retrieval limit");
      const minScore = parseOptionalScore(input.minScore, "Minimum score");
      validateClaimStatus(input.claimStatus);
      validateSubjectType(input.subjectType);

      const candidateLimit = Math.max(limit * 2, limit);
      const candidates: HybridSearchCandidate[] = [];

      if (plan.strategies.includes("structured")) {
        candidates.push(...await structuredKnowledgeSearch.search({
          query: plan.query,
          terms: plan.structuredTerms,
          limit: candidateLimit,
          claimStatus: input.claimStatus,
          subjectType: input.subjectType
        }));
      }

      if (plan.strategies.includes("semantic")) {
        const embedding = await embeddingProvider.embedQuery(plan.query);
        const results = await vectorStore.search({ embedding, limit: candidateLimit });
        candidates.push(...results.map(semanticCandidateFromResult));
      }

      const merged = new Map<string, HybridSearchCandidate>();
      for (const candidate of candidates) {
        const existing = merged.get(candidateKey(candidate));
        merged.set(candidateKey(candidate), existing ? mergeCandidate(existing, candidate) : candidate);
      }

      const items = Array.from(merged.values())
        .filter(isEligibleCandidate)
        .filter((candidate) => input.claimStatus === undefined || candidate.claimStatus === input.claimStatus)
        .filter((candidate) => input.subjectType === undefined || candidate.subjectType === input.subjectType)
        .map((candidate) => itemFromCandidate(candidate, config))
        .filter((item) => minScore === undefined || item.finalScore >= minScore)
        .sort((left, right) => {
          if (right.finalScore !== left.finalScore) {
            return right.finalScore - left.finalScore;
          }

          return stableIdentity(left).localeCompare(stableIdentity(right));
        })
        .slice(0, limit);

      return {
        query: plan.query,
        strategies: plan.strategies,
        items,
        generatedAt: now(),
        warnings: items.length === 0 ? ["No relevant eligible evidence was found."] : []
      };
    }
  };
}
