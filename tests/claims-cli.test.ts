import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

import { registerClaimsCommands } from "../src/modules/knowledge/interfaces/cli/claims-command.js";

function createProgram(createServices: Parameters<typeof registerClaimsCommands>[1]): Command {
  const program = new Command();
  program.exitOverride();
  registerClaimsCommands(program, createServices);
  return program;
}

describe("claims CLI commands", () => {
  it("removes stale embeddings when rejecting a claim", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const rejectClaim = { execute: vi.fn(async () => ({ claimId: "claim-1", status: "rejected" as const })) };
    const deleteClaimEmbeddings = { execute: vi.fn(async () => 2) };
    const program = createProgram(() => ({
      listClaimsRequiringReview: { execute: vi.fn(async () => []) },
      confirmClaim: { execute: vi.fn() },
      rejectClaim,
      deleteClaimEmbeddings,
      close: vi.fn(async () => undefined)
    }));

    await program.parseAsync(["node", "pke", "claims", "reject", "claim-1", "--reason", "Unsupported"]);

    expect(rejectClaim.execute).toHaveBeenCalledWith({ claimId: "claim-1", reason: "Unsupported" });
    expect(deleteClaimEmbeddings.execute).toHaveBeenCalledWith("claim-1");
    expect(log).toHaveBeenCalledWith("Rejected claim claim-1. Removed 2 embedding(s).");
  });
});
