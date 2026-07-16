import { CanonicalEvidenceReader } from "../../../retrieval/application/ports/canonical-evidence-reader.js";
import { EvidencePack } from "../../../retrieval/application/types.js";
import { CandidateEvidencePack, CandidateSelectionConfig, JobDescriptionWithRequirements } from "../../domain/model.js";

export interface RequirementEvidenceRetriever {
  execute(command: { requirementId: string; query: string }): Promise<EvidencePack>;
}

export interface RequirementCandidatePreparation {
  prepare(input: {
    jobDescription: JobDescriptionWithRequirements;
    jobAnalysisId?: string;
    warnings?: string[];
    selection?: CandidateSelectionConfig;
    retriever: RequirementEvidenceRetriever;
    canonicalEvidenceReader: CanonicalEvidenceReader;
  }): Promise<CandidateEvidencePack>;
}
