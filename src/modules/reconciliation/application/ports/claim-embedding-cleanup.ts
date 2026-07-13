export interface ClaimEmbeddingCleanup {
  removeClaimEmbeddings(claimId: string): Promise<number>;
}
