import { Command } from "commander"
import { describe, expect, it, vi } from "vitest"

import { ingestionErrorPayload } from "../src/modules/ingestion/infrastructure/ingest-markdown-runner.js"
import { registerIngestCommand } from "../src/modules/ingestion/interfaces/cli/ingest-command.js"
import { ProfessionalProfileValidationError } from "../src/modules/knowledge/domain/professional-profile.js"

describe("ingest CLI", () => {
  it("forwards machine-readable output selection to the runner", async () => {
    const runner = { run: vi.fn(async () => undefined) }
    const program = new Command().exitOverride()
    registerIngestCommand(program, runner)
    await program.parseAsync(["node", "pke", "ingest", "profile.md", "--json"])
    expect(runner.run).toHaveBeenCalledWith("profile.md", { json: true })
  })

  it("serializes canonical profile issue codes, paths, and corrective messages", () => {
    const error = new ProfessionalProfileValidationError([{ code: "missing_candidate_name", path: "candidate.Name", message: "Add an explicit Name." }])
    expect(ingestionErrorPayload(error)).toEqual({ error: { name: "ProfessionalProfileValidationError", message: expect.stringContaining("missing_candidate_name@candidate.Name"), issues: [{ code: "missing_candidate_name", path: "candidate.Name", message: "Add an explicit Name." }] } })
  })
})
