import { ResumeRenderer } from "../../application/ports/resume-renderer.js"
import { atsCleanV1Css, expectedResumeHeadings, resumeSectionLabels } from "../../application/templates/ats-clean-v1.js"
import { assertValidRenderedResume } from "../../application/resume-generation-validator.js"
import { RenderedResume, ResumeDocument, resumeRendererVersion } from "../../domain/resume-document.js"

export function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;")
}

function safeLink(url: string): string | undefined {
  try {
    const parsed = new URL(url.includes(":") ? url : `https://${url}`)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined
  } catch { return undefined }
}

export class HtmlResumeRenderer implements ResumeRenderer {
  readonly format = "html" as const

  async render(document: ResumeDocument): Promise<RenderedResume> {
    const labels = resumeSectionLabels(document.language)
    const contactItems = [
      document.header.location ? `<span>${escapeHtml(document.header.location)}</span>` : "",
      document.header.email ? `<a href="mailto:${escapeHtml(document.header.email)}">${escapeHtml(document.header.email)}</a>` : "",
      document.header.phone ? `<span>${escapeHtml(document.header.phone)}</span>` : "",
      ...document.header.links.map((link) => {
        const url = safeLink(link.url)
        return url ? `<a href="${escapeHtml(url)}">${escapeHtml(link.label)}</a>` : `<span>${escapeHtml(link.label)}: ${escapeHtml(link.url)}</span>`
      })
    ].filter(Boolean).join("\n")
    const summary = document.professionalSummary ? `<section aria-labelledby="summary"><h2 id="summary">${labels.summary}</h2><p>${escapeHtml(document.professionalSummary.text)}</p></section>` : ""
    const skills = document.skillGroups.length > 0 ? `<section aria-labelledby="skills"><h2 id="skills">${labels.skills}</h2>${document.skillGroups.map((group) => `<p class="skill-group"><strong>${escapeHtml(group.name)}:</strong> ${group.skills.map(escapeHtml).join(", ")}</p>`).join("\n")}</section>` : ""
    const experience = `<section aria-labelledby="experience"><h2 id="experience">${labels.experience}</h2>${document.experiences.map((entry) => `<article class="experience"><div class="experience-meta"><h3>${escapeHtml(entry.role)} — ${escapeHtml(entry.organization)}</h3><time>${escapeHtml(entry.startDate)} – ${escapeHtml(entry.endDate)}</time></div>${entry.context ? `<p>${escapeHtml(entry.context)}</p>` : ""}${entry.summary ? `<p>${escapeHtml(entry.summary.text)}</p>` : ""}${entry.achievements.length > 0 ? `<ul>${entry.achievements.map((achievement) => `<li>${escapeHtml(achievement.text)}</li>`).join("")}</ul>` : ""}</article>`).join("\n")}</section>`
    const education = document.education.length > 0 ? `<section aria-labelledby="education"><h2 id="education">${labels.education}</h2>${document.education.map((entry) => `<article class="education-entry"><h3>${escapeHtml(entry.title)}</h3>${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}</article>`).join("\n")}</section>` : ""
    const certifications = document.certifications.length > 0 ? `<section aria-labelledby="certifications"><h2 id="certifications">${labels.certifications}</h2>${document.certifications.map((entry) => `<article class="certification-entry"><h3>${escapeHtml(entry.title)}</h3>${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}</article>`).join("\n")}</section>` : ""
    const html = `<!doctype html>
<html lang="${document.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(document.header.name)} — Resume</title><style>${atsCleanV1Css}</style></head>
<body><header><h1>${escapeHtml(document.header.name)}</h1>${document.header.headline ? `<p>${escapeHtml(document.header.headline)}</p>` : ""}${contactItems ? `<div class="contact">${contactItems}</div>` : ""}</header><main>${summary}${skills}${experience}${education}${certifications}</main></body>
</html>
`
    const result: RenderedResume = { bytes: new TextEncoder().encode(html), format: this.format, mediaType: "text/html; charset=utf-8", templateId: document.templateId, templateVersion: document.templateVersion, rendererVersion: resumeRendererVersion }
    assertValidRenderedResume(result, expectedResumeHeadings(document))
    return result
  }
}
