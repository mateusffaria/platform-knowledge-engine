import { CandidateEvidencePack, EvidenceReasoningResult } from "../../domain/model.js";

export interface EvidenceReasoningRunIdentity {
  runIdentity: string;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface EvidenceReasoningCommand {
  candidatePack: CandidateEvidencePack;
  model?: string;
  regenerationId?: string;
}

export interface EvidenceReasoner {
  getRunIdentity(command: EvidenceReasoningCommand): EvidenceReasoningRunIdentity;
  reason(command: EvidenceReasoningCommand): Promise<EvidenceReasoningResult>;
}
