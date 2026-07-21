import { Command } from "commander"
import { describe, expect, it, vi } from "vitest"

import { missingCoverage } from "../src/modules/jobs/application/evidence-curation.js"
import { CandidateEvidencePack } from "../src/modules/jobs/domain/model.js"
import { parseJobSource } from "../src/modules/jobs/infrastructure/parsers/deterministic-job-source-parser.js"
import { registerJobsCommands } from "../src/modules/jobs/interfaces/cli/jobs-command.js"
import { registerDocumentsCommands } from "../src/modules/documents/interfaces/cli/documents-command.js"
import { EvidencePack } from "../src/modules/retrieval/application/types.js"

describe("atomic requirement CLI trace fixture", () => {
  it("preserves parent and component identities through ingestion, candidates, curation, and resume output", async () => {
    const document = parseJobSource("compound.md", "## Requirements\n- Strong knowledge of Go and PostgreSQL")
    const requirement = document.requirements[0]
    const componentIds = requirement.components!.map((component) => component.id)
    const emptyEvidence = (requirementId?: string): EvidencePack => ({
      requirementId,
      query: "component-scoped trace",
      strategies: [],
      generatedAt: new Date("2026-07-21T12:00:00.000Z"),
      warnings: [],
      items: [],
      diagnostics: {
        rawStructuredResultCount: 0,
        rawSemanticResultCount: 0,
        rawResults: [],
        eligibleResults: [],
        discardedResults: []
      }
    })
    const reason = vi.fn(async ({ candidatePack }: { candidatePack: CandidateEvidencePack }) => ({
      id: "curated-trace",
      runIdentity: "run-trace",
      jobDescriptionId: document.job.id,
      candidatePackVersion: candidatePack.version,
      candidatePackHash: candidatePack.hash,
      provider: "fixture",
      model: "fixture",
      promptVersion: "evidence-reasoner-v8",
      createdAt: new Date("2026-07-21T12:01:00.000Z"),
      overallCoverageSummary: "No fixture evidence supplied.",
      requirementCoverage: candidatePack.requirements.map(missingCoverage),
      recommendedEvidence: [],
      discardedEvidence: [],
      missingEvidence: [{ requirementId: requirement.id, requirementText: requirement.originalText, reason: "No fixture evidence supplied." }],
      warnings: [],
      warningDiagnostics: [],
      limitations: []
    }))
    const jobsServices = {
      ingestJobDescription: { execute: vi.fn(async () => ({ jobDescription: document, created: true })) },
      showJobDescription: { execute: vi.fn(async () => document) },
      analyzeJobDescription: { execute: vi.fn(async () => undefined) },
      buildJobRetrievalIntent: { execute: vi.fn(async () => ({
        jobDescriptionId: document.job.id,
        sourceRequirementIds: [requirement.id],
        inferredRequirementIds: [],
        inferredAnalysisRequirementIds: [],
        filters: [],
        componentIntents: requirement.components!.map((component) => ({
          requirementId: requirement.id,
          componentId: component.id,
          componentText: component.originalText,
          query: component.originalText,
          filters: []
        })),
        query: "Go PostgreSQL",
        semanticText: "Go PostgreSQL",
        warnings: []
      })) },
      reasonJobEvidence: { execute: reason },
      close: vi.fn(async () => undefined)
    }
    const retrievalServices = {
      hybridSearch: { execute: vi.fn(async (command: { requirementId?: string }) => emptyEvidence(command.requirementId)) },
      canonicalEvidenceReader: { read: vi.fn() },
      close: vi.fn(async () => undefined)
    }
    const documentsServices = {
      planResumeContent: { execute: vi.fn(async () => ({
        id: "plan-trace",
        planIdentity: "b".repeat(64),
        schemaVersion: "resume-content-plan/v2",
        jobDescriptionId: document.job.id,
        curatedEvidencePackId: "curated-trace",
        language: "en" as const,
        length: "standard" as const,
        professionalSummary: { text: "No supported content.", supportingEvidenceIds: [] },
        plannedExperiences: [],
        plannedSkillGroups: [],
        selectedEvidenceIds: [],
        omittedEvidence: [],
        uncoveredRequirementIds: [requirement.id],
        uncoveredRequirementComponentIds: componentIds,
        warnings: ["Atomic requirements remain uncovered."],
        provider: "fixture",
        model: "fixture",
        promptVersion: "resume-planning/v7",
        createdAt: new Date("2026-07-21T12:02:00.000Z")
      })) },
      close: vi.fn(async () => undefined)
    }
    const program = new Command().exitOverride()
    registerJobsCommands(program, () => jobsServices as never, () => retrievalServices as never)
    registerDocumentsCommands(program, () => documentsServices as never)
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

    await program.parseAsync(["node", "pke", "jobs", "ingest", "compound.md", "--json"])
    await program.parseAsync(["node", "pke", "jobs", "candidates", document.job.id, "--json"])
    await program.parseAsync(["node", "pke", "jobs", "reason", document.job.id, "--json"])
    await program.parseAsync(["node", "pke", "documents", "resume", "plan", document.job.id, "--json"])

    const [ingested, candidates, curated, plan] = log.mock.calls.map(([value]) => JSON.parse(String(value)))
    expect(ingested.jobDescription.requirements[0].id).toBe(requirement.id)
    expect(ingested.jobDescription.requirements[0].components.map((component: { id: string }) => component.id)).toEqual(componentIds)
    expect(candidates.requirements[0].requirementId).toBe(requirement.id)
    expect(candidates.requirements[0].components.map((component: { componentId: string }) => component.componentId)).toEqual(componentIds)
    expect(curated.requirementCoverage[0].requirementId).toBe(requirement.id)
    expect(curated.requirementCoverage[0].componentCoverage.map((component: { componentId: string }) => component.componentId)).toEqual(componentIds)
    expect(plan.uncoveredRequirementIds).toEqual([requirement.id])
    expect(plan.uncoveredRequirementComponentIds).toEqual(componentIds)
  })
})
