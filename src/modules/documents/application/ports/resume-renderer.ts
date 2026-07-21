import { RenderedResume, ResumeDocument, ResumeFormat } from "../../domain/resume-document.js"

export interface ResumeRenderer {
  readonly format: ResumeFormat
  render(document: ResumeDocument): Promise<RenderedResume>
}

export interface ResumeRendererRegistry {
  get(format: ResumeFormat): ResumeRenderer
}
