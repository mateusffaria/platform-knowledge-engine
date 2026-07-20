import { buildCandidateEvidencePack, candidateEvidencePackVersion, toCandidateEvidence } from "../../../jobs/application/candidate-evidence-pack.js"
import { EvidenceReasoner } from "../../../jobs/application/ports/evidence-reasoner.js"
import { CandidateEvidencePack, isDegradedEvidenceReasoningResult, JobDescriptionWithRequirements } from "../../../jobs/domain/model.js"
import { MetadataMatcher } from "../../../retrieval/application/ports/metadata-matcher.js"
import { StructuredKnowledgeSearch } from "../../../retrieval/application/ports/structured-knowledge-search.js"
import { createHybridSearchUseCase } from "../../../retrieval/application/use-cases/hybrid-search.js"
import { EvidencePack, HybridSearchCandidate } from "../../../retrieval/application/types.js"
import { EvaluationPipeline } from "../../application/ports/evaluation-pipeline.js"
import {
  EvaluationEvidenceFixture,
  EvaluationScenario,
  EvaluationStageExecution,
  EvaluationStageObservation
} from "../../domain/model.js"

function candidateFromFixture(evidence: EvaluationEvidenceFixture): HybridSearchCandidate {
  return {
    evidenceClaimId: evidence.id,
    knowledgeAssetId: evidence.knowledgeAssetId,
    subjectType: "experience",
    claimType: "experience",
    claimText: evidence.claimText,
    claimStatus: evidence.claimStatus,
    confidenceScore: evidence.confidenceScore,
    structuredScore: evidence.structuredScore ?? 1,
    semanticScore: evidence.semanticScore,
    sources: evidence.sources.flatMap((source) => source.sourceReferenceId ? [{
      id: source.sourceReferenceId,
      sourceDocumentId: source.sourceDocumentId,
      locator: source.locator,
      excerpt: source.excerpt
    }] : []),
    retrievalStrategies: ["structured"]
  }
}

function jobFromScenario(scenario: EvaluationScenario): JobDescriptionWithRequirements {
  return {
    job: {
      id: `evaluation-${scenario.id}`,
      sourceType: "plain_text",
      sourcePath: `evaluation://${scenario.id}`,
      rawContent: scenario.requirements.map((item) => item.text).join("\n"),
      contentHash: scenario.id,
      title: scenario.description,
      ingestedAt: new Date(0)
    },
    requirements: scenario.requirements.map((requirement, index) => ({
      id: requirement.id,
      jobDescriptionId: `evaluation-${scenario.id}`,
      requirementType: requirement.type,
      importance: requirement.importance,
      normalizedValue: requirement.text,
      originalText: requirement.text,
      sourceExcerpt: requirement.text,
      sourceLocation: { startLine: index + 1, endLine: index + 1 },
      sectionLabel: "Evaluation fixture",
      inferred: false
    }))
  }
}

function sourceObservation(evidence: EvaluationEvidenceFixture, requirementId?: string) {
  return { evidenceId: evidence.id, requirementId, sources: evidence.sources.map((source) => ({ ...source })) }
}

function emptyObservation(): EvaluationStageObservation {
  return { evidence: [], candidateEvidenceIdsByRequirement: {}, coverage: [], schemaValid: true }
}

function preparedRequirement(scenario: EvaluationScenario, requirementId: string, pack: EvidencePack) {
  const requirement = scenario.requirements.find((item) => item.id === requirementId)
  if (!requirement) throw new Error(`Unknown evaluation requirement ${requirementId}.`)
  const candidates = pack.items.flatMap((item) => {
    const candidate = toCandidateEvidence(item)
    return candidate ? [candidate] : []
  })
  return {
    requirementId,
    requirementText: requirement.text,
    requirementType: requirement.type,
    importance: requirement.importance,
    candidates,
    reasonerCandidateIds: [],
    diagnostics: {
      retrievalIntent: requirement.query,
      rawRetrievalResultCount: pack.diagnostics.rawResults.length,
      eligibleResultCount: pack.diagnostics.eligibleResults.length,
      canonicalHydrationCount: candidates.length,
      requirementAssociationCount: candidates.length,
      selectedForReasonerCount: 0,
      selectionExclusions: [],
      discardedResults: pack.diagnostics.discardedResults.map((discarded) => ({
        stage: "eligibility" as const,
        reasonCode: "ineligible_claim_status" as const,
        reason: discarded.reason,
        evidenceClaimId: discarded.evidenceClaimId,
        knowledgeAssetId: discarded.knowledgeAssetId,
        retrievalStrategies: discarded.retrievalStrategies,
        semanticScore: discarded.semanticScore,
        structuredScore: discarded.structuredScore,
        finalScore: discarded.finalScore
      }))
    }
  }
}

export class FixtureEvaluationPipeline implements EvaluationPipeline {
  constructor(private readonly reasoner?: EvidenceReasoner, private readonly now: () => number = () => Date.now()) {}

  async execute(scenario: EvaluationScenario): Promise<EvaluationStageExecution[]> {
    const executions: EvaluationStageExecution[] = []
    const packs: EvidencePack[] = []
    let candidatePack: CandidateEvidencePack | undefined

    if (!scenario.skipStages?.includes("retrieval")) {
      const started = this.now()
      try {
        const matcher: MetadataMatcher = {
          match: async (query) => {
            const requirement = scenario.requirements.find((item) => item.query === query.originalQuery)
            return requirement ? [{
              category: requirement.type === "technology" ? "technology" : "skill",
              value: requirement.text,
              normalizedValue: requirement.text.toLowerCase(),
              matchType: "exact",
              matchedText: requirement.text
            }] : []
          }
        }
        let activeRequirementId = ""
        const structuredKnowledgeSearch: StructuredKnowledgeSearch = {
          search: async () => scenario.evidence
            .filter((evidence) => evidence.requirementIds.includes(activeRequirementId))
            .map(candidateFromFixture)
        }
        const search = createHybridSearchUseCase({
          embeddingProvider: {
            embedDocuments: async () => [],
            embedQuery: async () => ({ provider: "fixture", model: "fixture", dimensions: 1, values: [1] })
          },
          vectorStore: {
            upsertEmbeddings: async () => ({ inserted: 0, updated: 0, unchanged: 0 }),
            search: async () => [],
            deleteEmbeddingsForSubject: async () => 0
          },
          structuredKnowledgeSearch,
          metadataMatcher: matcher,
          now: () => new Date(0)
        })
        for (const requirement of scenario.requirements) {
          activeRequirementId = requirement.id
          packs.push(await search.execute({ requirementId: requirement.id, query: requirement.query, limit: Math.max(10, scenario.evidence.length) }))
        }
        const evidence = packs.flatMap((pack) => pack.items.flatMap((item) => {
          const fixture = scenario.evidence.find((candidate) => candidate.id === item.evidenceClaimId)
          return fixture ? [sourceObservation(fixture, pack.requirementId)] : []
        }))
        executions.push({
          stage: "retrieval",
          observation: { ...emptyObservation(), evidence },
          metadata: { durationMs: this.now() - started }
        })
      } catch (error) {
        executions.push({ stage: "retrieval", metadata: { durationMs: this.now() - started }, error: { code: "retrieval_error", message: error instanceof Error ? error.message : "Retrieval failed." } })
      }
    }

    if (!scenario.skipStages?.includes("candidate_association")) {
      const started = this.now()
      if (executions.find((item) => item.stage === "retrieval")?.error) {
        executions.push({ stage: "candidate_association", metadata: { durationMs: 0 }, error: { code: "blocked", message: "Retrieval input was unavailable." } })
      } else {
        try {
          const mergedPack: EvidencePack = {
            query: scenario.requirements.map((item) => item.query).join(" "),
            strategies: ["structured"],
            items: packs.flatMap((pack) => pack.items),
            diagnostics: {
              rawStructuredResultCount: packs.reduce((sum, pack) => sum + pack.diagnostics.rawStructuredResultCount, 0),
              rawSemanticResultCount: 0,
              rawResults: packs.flatMap((pack) => pack.diagnostics.rawResults),
              eligibleResults: packs.flatMap((pack) => pack.diagnostics.eligibleResults),
              discardedResults: packs.flatMap((pack) => pack.diagnostics.discardedResults)
            },
            generatedAt: new Date(0),
            warnings: packs.flatMap((pack) => pack.warnings)
          }
          candidatePack = buildCandidateEvidencePack({
            jobDescription: jobFromScenario(scenario),
            evidencePack: mergedPack,
            preparedRequirements: packs.map((pack) => preparedRequirement(scenario, pack.requirementId ?? "", pack))
          })
          const candidateEvidenceIdsByRequirement = Object.fromEntries(candidatePack.requirements.map((requirement) => [requirement.requirementId, requirement.candidates.map((item) => item.evidenceClaimId)]))
          const evidence = candidatePack.requirements.flatMap((requirement) => requirement.candidates.map((candidate) => ({
            evidenceId: candidate.evidenceClaimId,
            requirementId: requirement.requirementId,
            sources: candidate.sources.map((source) => ({
              sourceDocumentId: source.sourceDocumentId,
              sourceReferenceId: source.sourceReferenceId,
              locator: source.locator,
              excerpt: source.excerpt
            }))
          })))
          executions.push({ stage: "candidate_association", observation: { ...emptyObservation(), evidence, candidateEvidenceIdsByRequirement }, metadata: { candidatePackVersion: candidatePack.version, durationMs: this.now() - started } })
        } catch (error) {
          executions.push({ stage: "candidate_association", metadata: { durationMs: this.now() - started }, error: { code: "candidate_association_error", message: error instanceof Error ? error.message : "Candidate association failed." } })
        }
      }
    }

    if (!scenario.skipStages?.includes("reasoning")) {
      const started = this.now()
      if (!candidatePack && !scenario.skipStages?.includes("candidate_association")) {
        executions.push({ stage: "reasoning", metadata: { durationMs: 0 }, error: { code: "blocked", message: "Candidate Evidence Pack input was unavailable." } })
      } else {
        try {
          const effectivePack = candidatePack ?? buildCandidateEvidencePack({
            jobDescription: jobFromScenario(scenario),
            evidencePack: { query: scenario.id, strategies: [], items: [], diagnostics: { rawStructuredResultCount: 0, rawSemanticResultCount: 0, rawResults: [], eligibleResults: [], discardedResults: [] }, generatedAt: new Date(0), warnings: [] }
          })
          let coverage = scenario.reasoning?.coverage ?? []
          let provider = scenario.reasoning?.provider
          let model = scenario.reasoning?.model
          let promptVersion = scenario.reasoning?.promptVersion
          if (this.reasoner) {
            const identity = this.reasoner.getRunIdentity({ candidatePack: effectivePack })
            const reasoned = await this.reasoner.reason({ candidatePack: effectivePack })
            const curated = isDegradedEvidenceReasoningResult(reasoned) ? reasoned.curatedEvidencePack : reasoned
            coverage = curated.requirementCoverage.map((entry) => ({
              requirementId: entry.requirementId,
              coverageStatus: entry.coverageStatus,
              selectedEvidenceIds: entry.selectedEvidenceIds,
              rejectedEvidenceIds: entry.rejectedCandidateEvidenceIds
            }))
            provider = identity.provider
            model = identity.model
            promptVersion = identity.promptVersion
          }
          const selected = coverage.flatMap((entry) => entry.selectedEvidenceIds.map((evidenceId) => {
            const fixture = scenario.evidence.find((candidate) => candidate.id === evidenceId)
            return fixture ? sourceObservation(fixture, entry.requirementId) : { evidenceId, requirementId: entry.requirementId, sources: [] }
          }))
          executions.push({
            stage: "reasoning",
            observation: {
              evidence: selected,
              candidateEvidenceIdsByRequirement: Object.fromEntries(effectivePack.requirements.map((requirement) => [requirement.requirementId, requirement.candidates.map((candidate) => candidate.evidenceClaimId)])),
              coverage,
              schemaValid: true
            },
            metadata: {
              provider,
              model,
              promptVersion,
              candidatePackVersion: effectivePack.version ?? candidateEvidencePackVersion,
              durationMs: this.now() - started,
              promptTokens: scenario.reasoning?.promptTokens,
              completionTokens: scenario.reasoning?.completionTokens
            }
          })
        } catch (error) {
          executions.push({ stage: "reasoning", metadata: { candidatePackVersion: candidatePack?.version, durationMs: this.now() - started }, error: { code: "reasoning_error", message: error instanceof Error ? error.message : "Reasoning failed." } })
        }
      }
    }

    return executions
  }
}
