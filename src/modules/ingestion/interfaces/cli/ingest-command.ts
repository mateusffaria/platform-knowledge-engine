import { Command } from "commander";

export interface IngestCommandRunner {
  run(sourcePath: string, options?: { json?: boolean }): Promise<void>;
}

export function registerIngestCommand(program: Command, runner: IngestCommandRunner): void {
  program
    .command("ingest")
    .description("Ingest a Markdown professional knowledge source")
    .argument("<path>", "Path to a .md or .markdown source file")
    .option("--json", "print one machine-readable ingestion result or error")
    .action(async (sourcePath: string, options: { json?: boolean }) => {
      await runner.run(sourcePath, options);
    });
}
