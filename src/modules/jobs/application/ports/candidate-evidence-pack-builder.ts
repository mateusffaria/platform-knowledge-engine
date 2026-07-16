import { EvidencePack } from "../../../retrieval/application/types.js";
import { CandidateEvidencePack, CandidateRequirementEvidence, JobDescriptionWithRequirements } from "../../domain/model.js";

export interface CandidateEvidencePackBuilder {
  build(input: {
    jobDescription: JobDescriptionWithRequirements;
    jobAnalysisId?: string;
    evidencePack: EvidencePack;
    preparedRequirements?: CandidateRequirementEvidence[];
  }): CandidateEvidencePack;
}
