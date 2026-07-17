import { CandidateEvidencePack, EvidenceReasoningResult } from "../../domain/model.js";

export interface EvidenceReasoningRunIdentity {
  runIdentity: string;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface EvidenceReasoner {
  getRunIdentity(command: { candidatePack: CandidateEvidencePack; model?: string }): EvidenceReasoningRunIdentity;
  reason(command: { candidatePack: CandidateEvidencePack; model?: string }): Promise<EvidenceReasoningResult>;
}
