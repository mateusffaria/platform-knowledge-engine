import { describe, expect, it, vi } from "vitest";

import { createTerminalProgress } from "../src/shared/cli/terminal-progress.js";

function terminal(isTTY: boolean) {
  return {
    isTTY,
    write: vi.fn(() => true)
  } as unknown as NodeJS.WriteStream;
}

describe("terminal progress", () => {
  it("renders transient feedback only to an interactive stream", () => {
    let now = 0;
    const stream = terminal(true);
    const progress = createTerminalProgress({ enabled: true, stream, now: () => now, refreshIntervalMs: 60_000, isCi: false });

    progress.start("Preparing candidates");
    now = 65_000;
    progress.update("Curating evidence");
    progress.succeed("Evidence curation complete");

    expect(stream.write).toHaveBeenNthCalledWith(1, "\r\u001B[2K⠋ Preparing candidates (00:00 elapsed)");
    expect(stream.write).toHaveBeenNthCalledWith(2, "\r\u001B[2K⠙ Curating evidence (01:05 elapsed)");
    expect(stream.write).toHaveBeenNthCalledWith(3, "\r\u001B[2K✓ Evidence curation complete (01:05)\n");
  });

  it("does not write when disabled or redirected", () => {
    for (const options of [
      { enabled: false, stream: terminal(true) },
      { enabled: true, stream: terminal(false) },
      { enabled: true, stream: terminal(true), isCi: true }
    ]) {
      const progress = createTerminalProgress(options);
      progress.start("Preparing candidates");
      progress.update("Curating evidence");
      progress.succeed("Evidence curation complete");
      expect(options.stream.write).not.toHaveBeenCalled();
    }
  });
});
