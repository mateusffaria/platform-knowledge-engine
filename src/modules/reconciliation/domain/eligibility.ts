import { ClaimStatus } from "./model.js";

export function isClaimIndexableStatus(status: ClaimStatus): boolean {
  return status === "confirmed" || status === "single_source";
}
