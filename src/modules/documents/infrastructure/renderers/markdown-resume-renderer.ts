import { ResumeRenderer } from "../../application/ports/resume-renderer.js"
import { expectedResumeHeadings, resumeSectionLabels } from "../../application/templates/ats-clean-v1.js"
import { assertValidRenderedResume } from "../../application/resume-generation-validator.js"
import { RenderedResume, ResumeDocument, resumeRendererVersion } from "../../domain/resume-document.js"

export function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+.!>|-])/gu, "\\$1")
}

export class MarkdownResumeRenderer implements ResumeRenderer {
  readonly format = "markdown" as const

  async render(document: ResumeDocument): Promise<RenderedResume> {
    const labels = resumeSectionLabels(document.language)
    const lines: string[] = [`# ${escapeMarkdown(document.header.name)}`]
    if (document.header.headline) lines.push(escapeMarkdown(document.header.headline))
    const contacts = [document.header.location, document.header.email, document.header.phone, ...document.header.links.map((link) => `[${escapeMarkdown(link.label)}](${link.url.replace(/\)/gu, "%29")})`)].filter(Boolean)
    if (contacts.length > 0) lines.push(contacts.join(" · "))
    if (document.professionalSummary) lines.push("", `## ${labels.summary}`, "", escapeMarkdown(document.professionalSummary.text))
    if (document.skillGroups.length > 0) {
      lines.push("", `## ${labels.skills}`, "")
      for (const group of document.skillGroups) lines.push(`- **${escapeMarkdown(group.name)}:** ${group.skills.map(escapeMarkdown).join(", ")}`)
    }
    lines.push("", `## ${labels.experience}`)
    for (const experience of document.experiences) {
      lines.push("", `### ${escapeMarkdown(experience.role)} — ${escapeMarkdown(experience.organization)}`, "", `${escapeMarkdown(experience.startDate)} – ${escapeMarkdown(experience.endDate)}`)
      if (experience.context) lines.push("", escapeMarkdown(experience.context))
      if (experience.summary) lines.push("", escapeMarkdown(experience.summary.text))
      if (experience.achievements.length > 0) lines.push("", ...experience.achievements.map((achievement) => `- ${escapeMarkdown(achievement.text)}`))
    }
    if (document.education.length > 0) {
      lines.push("", `## ${labels.education}`)
      for (const entry of document.education) lines.push("", `### ${escapeMarkdown(entry.title)}`, ...(entry.details ? ["", escapeMarkdown(entry.details)] : []))
    }
    if (document.certifications.length > 0) {
      lines.push("", `## ${labels.certifications}`, "")
      for (const entry of document.certifications) lines.push(`- ${escapeMarkdown(entry.title)}${entry.details ? ` — ${escapeMarkdown(entry.details)}` : ""}`)
    }
    const content = `${lines.join("\n").replace(/\n{3,}/gu, "\n\n").trim()}\n`
    const result: RenderedResume = { bytes: new TextEncoder().encode(content), format: this.format, mediaType: "text/markdown; charset=utf-8", templateId: document.templateId, templateVersion: document.templateVersion, rendererVersion: resumeRendererVersion }
    assertValidRenderedResume(result, expectedResumeHeadings(document))
    return result
  }
}
