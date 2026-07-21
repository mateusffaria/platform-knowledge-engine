import { ResumeRenderer, ResumeRendererRegistry } from "../../application/ports/resume-renderer.js"
import { ResumeFormat } from "../../domain/resume-document.js"

export class DefaultResumeRendererRegistry implements ResumeRendererRegistry {
  private readonly renderers: Map<ResumeFormat, ResumeRenderer>

  constructor(renderers: ResumeRenderer[]) {
    this.renderers = new Map(renderers.map((renderer) => [renderer.format, renderer]))
  }

  get(format: ResumeFormat): ResumeRenderer {
    const renderer = this.renderers.get(format)
    if (!renderer) throw new Error(`Unsupported resume format: ${format}.`)
    return renderer
  }
}
