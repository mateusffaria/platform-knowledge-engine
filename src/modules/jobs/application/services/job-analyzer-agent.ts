import { randomUUID } from "node:crypto";

import { JobAnalyzer } from "../ports/job-analyzer.js";
import { JobAnalysisObservability } from "../ports/job-analysis-observability.js";
import { LlmProvider } from "../ports/llm-provider.js";
import { buildJobAnalyzerUserPrompt, jobAnalyzerPromptVersion, jobAnalyzerSystemPrompt } from "../job-analysis-prompt.js";
import { parseJobAnalysisContent } from "../job-analysis-schema.js";

export class JobAnalyzerAgent implements JobAnalyzer {
  constructor(
    private readonly provider: LlmProvider,
    private readonly observability: JobAnalysisObservability
  ) {}

  async analyze(command: Parameters<JobAnalyzer["analyze"]>[0]) {
    const trace = this.observability.trace("job-analysis", {
      jobDescriptionId: command.jobDescription.job.id,
      promptVersion: jobAnalyzerPromptVersion,
      requestedModel: command.model
    });

    try {
      let generated;
      try {
        generated = await this.provider.generate({
          systemPrompt: jobAnalyzerSystemPrompt,
          userPrompt: buildJobAnalyzerUserPrompt(command.jobDescription),
          model: command.model,
          responseFormat: "json"
        });
        await trace.event("provider_completed", { provider: generated.provider, model: generated.model });
      } catch (error) {
        await trace.event("provider_failed", { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }

      try {
        const content = parseJobAnalysisContent(generated.content, command.jobDescription);
        await trace.event("validation_succeeded");
        return {
          id: randomUUID(),
          jobDescriptionId: command.jobDescription.job.id,
          provider: generated.provider,
          model: generated.model,
          promptVersion: jobAnalyzerPromptVersion,
          createdAt: new Date(),
          ...content
        };
      } catch (error) {
        await trace.event("validation_failed", { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    } finally {
      await trace.flush();
    }
  }
}
