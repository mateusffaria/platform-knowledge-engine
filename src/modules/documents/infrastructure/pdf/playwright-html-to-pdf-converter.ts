import { HtmlToPdfConverter } from "../../application/ports/pdf-rendering.js"

export class PlaywrightHtmlToPdfConverter implements HtmlToPdfConverter {
  private browser: import("playwright").Browser | undefined

  private async getBrowser(): Promise<import("playwright").Browser> {
    if (!this.browser) {
      const { chromium } = await import("playwright")
      this.browser = await chromium.launch({ headless: true })
    }
    return this.browser
  }

  async convert(html: string): Promise<Uint8Array> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    try {
      await page.setContent(html, { waitUntil: "load" })
      await page.emulateMedia({ media: "print" })
      return await page.pdf({ format: "A4", margin: { top: "15mm", right: "16mm", bottom: "15mm", left: "16mm" }, printBackground: true, preferCSSPageSize: true, tagged: true })
    } finally { await page.close() }
  }

  async close(): Promise<void> {
    const browser = this.browser
    this.browser = undefined
    await browser?.close()
  }
}
