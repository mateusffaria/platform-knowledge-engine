import { Command } from "commander";

export interface IngestCommandRunner {
  run(sourcePath: string): Promise<void>;
}

export function registerIngestCommand(program: Command, runner: IngestCommandRunner): void {
  program
    .command("ingest")
    .description("Ingest a Markdown professional knowledge source")
    .argument("<path>", "Path to a .md or .markdown source file")
    .action(async (sourcePath: string) => {
      await runner.run(sourcePath);
    });
}
