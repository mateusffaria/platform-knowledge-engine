import { describe, expect, it } from "vitest";

import { CanonicalEvidenceReader } from "../src/modules/retrieval/application/ports/canonical-evidence-reader.js";
import { EvidencePack, HybridSearchCandidate } from "../src/modules/retrieval/application/types.js";
import { createPrepareCandidateEvidenceUseCase } from "../src/modules/jobs/application/use-cases/prepare-candidate-evidence.js";
import { JobDescriptionWithRequirements } from "../src/modules/jobs/domain/model.js";
import { parseJobSource } from "../src/modules/jobs/infrastructure/parsers/deterministic-job-source-parser.js";

const requirements = [
  ["go", "technology", "Go"],
  ["postgresql", "technology", "PostgreSQL"],
  ["aws", "technology", "AWS"],
  ["leadership", "responsibility", "technical leadership"],
  ["financial", "domain", "financial systems"],
  ["kubernetes", "technology", "Kubernetes"]
] as const;

function jobDescription(): JobDescriptionWithRequirements {
  return {
    job: {
      id: "job-pipeline",
      sourceType: "markdown",
      sourcePath: "fixtures/pipeline-job.md",
      rawContent: "pipeline job",
      contentHash: "pipeline-job-hash",
      ingestedAt: new Date("2026-07-16T00:00:00.000Z")
    },
    requirements: requirements.map(([id, requirementType, text], index) => ({
      id: `requirement-${id}`,
      jobDescriptionId: "job-pipeline",
      requirementType,
      importance: "required",
      normalizedValue: requirementType === "technology" ? text : undefined,
      originalText: text,
      sourceExcerpt: text,
      sourceLocation: { startLine: index + 1, endLine: index + 1 },
      inferred: false
    }))
  };
}

function rawCandidate(id: string, asset: string, overrides: Partial<HybridSearchCandidate> = {}): HybridSearchCandidate {
  return {
    evidenceClaimId: id,
    knowledgeAssetId: asset,
    subjectType: "evidence_claim",
    claimText: "legacy semantic projection without structured predicate",
    confidenceScore: 0,
    semanticScore: 0.55,
    sources: [],
    retrievalStrategies: ["semantic"],
    ...overrides
  };
}

function evidencePack(query: string, rawResults: HybridSearchCandidate[]): EvidencePack {
  return {
    query,
    strategies: ["semantic"],
    items: [],
    diagnostics: {
      rawStructuredResultCount: 0,
      rawSemanticResultCount: rawResults.length,
      rawResults,
      eligibleResults: [],
      discardedResults: []
    },
    generatedAt: new Date("2026-07-16T00:00:00.000Z"),
    warnings: []
  };
}

describe("candidate evidence pipeline", () => {
  it("retrieves compound components independently and deduplicates repeated warnings", async () => {
    const document = parseJobSource("compound.md", "## Requirements\n- Strong knowledge of Go and PostgreSQL");
    const calls: Array<{ requirementId: string; componentId?: string; query: string }> = [];
    const pack = await createPrepareCandidateEvidenceUseCase().prepare({
      jobDescription: document,
      retriever: {
        async execute(command) {
          calls.push(command);
          const raw = command.query.includes("PostgreSQL") ? [rawCandidate("claim-postgresql", "asset-postgresql", { finalScore: 0.9 })] : [];
          return { ...evidencePack(command.query, raw), warnings: ["Repeated retrieval warning."] };
        }
      },
      canonicalEvidenceReader: {
        async read(input) {
          return {
            kind: "hydrated",
            candidates: [{
              evidenceClaimId: input.evidenceClaimId!,
              knowledgeAssetId: input.knowledgeAssetId,
              subjectType: "experience",
              claimType: "experience",
              claimText: "Operated PostgreSQL in production.",
              claimStatus: "confirmed",
              confidenceScore: 90,
              finalScore: input.finalScore,
              sources: [],
              retrievalStrategies: input.retrievalStrategies
            }]
          };
        }
      }
    });

    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((call) => call.componentId)).size).toBe(2);
    expect(pack.requirements).toHaveLength(1);
    expect(pack.requirements[0].components?.map((component) => [component.componentText, component.candidates.length])).toEqual([["Go", 0], ["PostgreSQL", 1]]);
    expect(pack.diagnostics).toEqual(expect.objectContaining({ parentRequirementCount: 1, atomicComponentCount: 2 }));
    expect(pack.diagnostics?.selectedEvidencePerComponent.map((entry) => entry.count)).toEqual([0, 1]);
    expect(pack.warnings).toEqual(["Repeated retrieval warning."]);
    expect(pack.warningDiagnostics).toEqual([{ code: "candidate_evidence_pack", message: "Repeated retrieval warning." }]);
  });

  it("retains equal warning messages when their stable condition codes differ", async () => {
    const document = parseJobSource("compound.md", "## Requirements\n- Strong knowledge of Go and PostgreSQL");
    const pack = await createPrepareCandidateEvidenceUseCase().prepare({
      jobDescription: document,
      retriever: {
        async execute(command) {
          return {
            ...evidencePack(command.query, []),
            warningDiagnostics: [{
              code: command.query.includes("PostgreSQL") ? "database_warning" : "language_warning",
              message: "Partial results."
            }]
          };
        }
      },
      canonicalEvidenceReader: { read: async () => { throw new Error("No hydration expected."); } }
    });

    expect(pack.warningDiagnostics).toEqual([
      { code: "database_warning", message: "Partial results." },
      { code: "language_warning", message: "Partial results." }
    ]);
  });

  it("hydrates and associates canonical evidence per requirement while keeping Kubernetes explicitly empty", async () => {
    const byRequirement: Record<string, HybridSearchCandidate[]> = {
      Go: [rawCandidate("claim-go", "asset-go")],
      PostgreSQL: [rawCandidate("claim-postgres", "asset-postgres")],
      AWS: [rawCandidate("claim-aws", "asset-aws")],
      "technical leadership": [rawCandidate("claim-leadership", "asset-leadership")],
      "financial systems": [rawCandidate("claim-pismo", "asset-pismo")],
      Kubernetes: []
    };
    const canonicalReader: CanonicalEvidenceReader = {
      async read(input) {
        const label = input.evidenceClaimId?.replace("claim-", "") ?? "unknown";
        return {
          kind: "hydrated",
          candidates: [{
            evidenceClaimId: input.evidenceClaimId!,
            knowledgeAssetId: input.knowledgeAssetId,
            subjectAssetId: input.knowledgeAssetId,
            subjectType: "experience",
            claimType: "experience",
            claimCategory: "capability",
            predicate: "demonstrates",
            claimText: label === "pismo" ? "Built financial systems at Pismo." : `Delivered ${label} in production.`,
            claimStatus: "confirmed",
            confidenceScore: 90,
            semanticScore: input.semanticScore,
            structuredScore: input.structuredScore,
            sources: [{ id: `source-${label}`, sourceDocumentId: "profile", excerpt: `Evidence for ${label}.` }],
            retrievalStrategies: input.retrievalStrategies
          }]
        };
      }
    };

    const pack = await createPrepareCandidateEvidenceUseCase().prepare({
      jobDescription: jobDescription(),
      retriever: { execute: async ({ query }) => evidencePack(query, byRequirement[requirements.find(([, , text]) => query.endsWith(text))?.[2] ?? ""] ?? []) },
      canonicalEvidenceReader: canonicalReader
    });

    for (const id of ["go", "postgresql", "aws", "leadership", "financial"]) {
      const requirement = pack.requirements.find((item) => item.requirementId === `requirement-${id}`)!;
      expect(requirement.candidates).toHaveLength(1);
      expect(requirement.diagnostics).toMatchObject({
        rawRetrievalResultCount: 1,
        eligibleResultCount: 1,
        canonicalHydrationCount: 1,
        requirementAssociationCount: 1
      });
    }
    expect(pack.requirements.find((item) => item.requirementId === "requirement-financial")!.candidates[0].claimText).toContain("Pismo");
    expect(pack.requirements.find((item) => item.requirementId === "requirement-kubernetes")).toMatchObject({
      candidates: [],
      diagnostics: { rawRetrievalResultCount: 0, requirementAssociationCount: 0, discardedResults: [] }
    });
  });

  it("returns an explicit hydration diagnostic when a retrieval identity cannot be resolved", async () => {
    const pack = await createPrepareCandidateEvidenceUseCase().prepare({
      jobDescription: { ...jobDescription(), requirements: [jobDescription().requirements[0]] },
      retriever: { execute: async ({ query }) => evidencePack(query, [rawCandidate("claim-missing", "asset-missing")]) },
      canonicalEvidenceReader: {
        async read() {
          return { kind: "discarded", reasonCode: "canonical_claim_not_found", reason: "Canonical evidence claim claim-missing was not found." };
        }
      }
    });

    expect(pack.requirements[0].diagnostics.discardedResults).toEqual([expect.objectContaining({
      stage: "hydration",
      reasonCode: "canonical_claim_not_found",
      evidenceClaimId: "claim-missing",
      knowledgeAssetId: "asset-missing"
    })]);
  });

  it("preserves final score through canonical fan-out and normalizes duplicate association diagnostics", async () => {
    const rawResults: HybridSearchCandidate[] = [
      {
        knowledgeAssetId: "asset-fan-out",
        subjectType: "knowledge_asset",
        claimText: "asset projection",
        confidenceScore: 80,
        finalScore: 0.61,
        semanticScore: 0.4,
        sources: [],
        retrievalStrategies: ["semantic"]
      },
      {
        knowledgeAssetId: "asset-fan-out",
        subjectType: "knowledge_asset",
        claimText: "asset projection",
        confidenceScore: 80,
        finalScore: 0.91,
        structuredScore: 1,
        sources: [],
        retrievalStrategies: ["structured"]
      }
    ];
    const pack = await createPrepareCandidateEvidenceUseCase().prepare({
      jobDescription: { ...jobDescription(), requirements: [jobDescription().requirements[0]] },
      retriever: { execute: async ({ query }) => evidencePack(query, rawResults) },
      canonicalEvidenceReader: {
        async read(input) {
          return {
            kind: "hydrated",
            candidates: ["claim-a", "claim-b"].map((evidenceClaimId) => ({
              evidenceClaimId,
              knowledgeAssetId: input.knowledgeAssetId,
              subjectType: "experience" as const,
              claimText: `${evidenceClaimId} canonical claim`,
              claimStatus: "confirmed" as const,
              confidenceScore: 80,
              finalScore: input.finalScore,
              semanticScore: input.semanticScore,
              structuredScore: input.structuredScore,
              sources: [],
              retrievalStrategies: input.retrievalStrategies
            }))
          };
        }
      }
    });

    const requirement = pack.requirements[0];
    expect(requirement.diagnostics).toMatchObject({
      rawRetrievalResultCount: 2,
      canonicalHydrationCount: 4,
      eligibleResultCount: 4,
      requirementAssociationCount: 2
    });
    expect(requirement.candidates.map((candidate) => [candidate.evidenceClaimId, candidate.objectiveSignals.finalScore])).toEqual([
      ["claim-a", 0.91],
      ["claim-b", 0.91]
    ]);
    expect(requirement.diagnostics.discardedResults).toEqual([
      expect.objectContaining({
        stage: "association",
        reasonCode: "duplicate_requirement_candidate",
        finalScore: 0.91,
        retrievalStrategies: ["structured", "semantic"]
      }),
      expect.objectContaining({
        stage: "association",
        reasonCode: "duplicate_requirement_candidate",
        finalScore: 0.91,
        retrievalStrategies: ["structured", "semantic"]
      })
    ]);
  });
});
