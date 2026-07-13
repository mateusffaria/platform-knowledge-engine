import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

import { registerClaimsCommands } from "../src/modules/reconciliation/interfaces/cli/claims-command.js";

function createProgram(createServices: Parameters<typeof registerClaimsCommands>[1]): Command {
  const program = new Command();
  program.exitOverride();
  registerClaimsCommands(program, createServices);
  return program;
}

describe("claims CLI commands", () => {
  it("lists claims requiring review", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const listClaimsRequiringReview = { execute: vi.fn(async () => [{
      id: "claim-1",
      status: "needs_review" as const,
      confidenceScore: 40,
      conflictSeverity: "high" as const,
      reviewReason: "Conflicting experience evidence.",
      claimType: "experience" as const,
      claimText: "Staff Engineer at Acme",
      sourcePath: "profile.md",
      sourceReferenceSection: "Experience",
      sourceReferenceLocator: "line:4",
      sourceReferenceExcerpt: "Staff Engineer at Acme"
    }]) };
    const program = createProgram(() => ({
      listClaimsRequiringReview,
      confirmClaim: { execute: vi.fn() },
      rejectClaim: { execute: vi.fn() },
      close: vi.fn(async () => undefined)
    }));

    await program.parseAsync(["node", "pke", "claims", "review"]);

    expect(listClaimsRequiringReview.execute).toHaveBeenCalledWith();
    expect(log).toHaveBeenCalledWith("1. claim-1 experience status=needs_review severity=high confidence=40");
  });

  it("confirms a claim", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const confirmClaim = { execute: vi.fn(async () => ({ claimId: "claim-1", status: "confirmed" as const })) };
    const program = createProgram(() => ({
      listClaimsRequiringReview: { execute: vi.fn(async () => []) },
      confirmClaim,
      rejectClaim: { execute: vi.fn() },
      close: vi.fn(async () => undefined)
    }));

    await program.parseAsync(["node", "pke", "claims", "confirm", "claim-1"]);

    expect(confirmClaim.execute).toHaveBeenCalledWith({ claimId: "claim-1" });
    expect(log).toHaveBeenCalledWith("Confirmed claim claim-1.");
  });

  it("removes stale embeddings when rejecting a claim", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const rejectClaim = { execute: vi.fn(async () => ({
      claimId: "claim-1",
      status: "rejected" as const,
      removedEmbeddings: 2
    })) };
    const program = createProgram(() => ({
      listClaimsRequiringReview: { execute: vi.fn(async () => []) },
      confirmClaim: { execute: vi.fn() },
      rejectClaim,
      close: vi.fn(async () => undefined)
    }));

    await program.parseAsync(["node", "pke", "claims", "reject", "claim-1", "--reason", "Unsupported"]);

    expect(rejectClaim.execute).toHaveBeenCalledWith({ claimId: "claim-1", reason: "Unsupported" });
    expect(log).toHaveBeenCalledWith("Rejected claim claim-1. Removed 2 embedding(s).");
  });
});
