import { HtmlToPdfConverter, PdfInspector } from "../../application/ports/pdf-rendering.js"
import { ResumeRenderer } from "../../application/ports/resume-renderer.js"
import { expectedResumeHeadings } from "../../application/templates/ats-clean-v1.js"
import { assertValidRenderedResume } from "../../application/resume-generation-validator.js"
import { RenderedResume, ResumeDocument, resumeRendererVersion } from "../../domain/resume-document.js"
import { HtmlResumeRenderer } from "./html-resume-renderer.js"

export class PdfResumeRenderer implements ResumeRenderer {
  readonly format = "pdf" as const

  constructor(private readonly htmlRenderer: HtmlResumeRenderer, private readonly converter: HtmlToPdfConverter, private readonly inspector: PdfInspector) {}

  async render(document: ResumeDocument): Promise<RenderedResume> {
    const html = await this.htmlRenderer.render(document)
    const bytes = await this.converter.convert(new TextDecoder().decode(html.bytes))
    const inspection = await this.inspector.inspect(bytes)
    const result: RenderedResume = {
      bytes,
      format: this.format,
      mediaType: "application/pdf",
      templateId: document.templateId,
      templateVersion: document.templateVersion,
      rendererVersion: resumeRendererVersion,
      pageCount: inspection.pageCount,
      extractedText: inspection.text
    }
    assertValidRenderedResume(result, expectedResumeHeadings(document))
    return result
  }
}
