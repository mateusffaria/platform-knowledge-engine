import { PdfInspector, PdfInspection } from "../../application/ports/pdf-rendering.js"

export class PdfJsInspector implements PdfInspector {
  async inspect(bytes: Uint8Array): Promise<PdfInspection> {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const loadingTask = getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false })
    const document = await loadingTask.promise
    const pages: string[] = []
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ").replace(/\s+/gu, " ").trim())
      }
      return { pageCount: document.numPages, text: pages.join("\n").trim() }
    } finally { await document.cleanup(); await loadingTask.destroy() }
  }
}
