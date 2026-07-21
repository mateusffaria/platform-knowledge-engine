export interface HtmlToPdfConverter {
  convert(html: string): Promise<Uint8Array>
  close(): Promise<void>
}

export interface PdfInspection {
  pageCount: number
  text: string
}

export interface PdfInspector {
  inspect(bytes: Uint8Array): Promise<PdfInspection>
}
