import { ResumeDocument } from "../../domain/resume-document.js"

export interface ResumeSectionLabels {
  summary: string
  skills: string
  experience: string
  education: string
  certifications: string
}

export function resumeSectionLabels(language: ResumeDocument["language"]): ResumeSectionLabels {
  return language === "pt-BR"
    ? { summary: "Resumo Profissional", skills: "Competências Técnicas", experience: "Experiência Profissional", education: "Formação Acadêmica", certifications: "Certificações" }
    : { summary: "Professional Summary", skills: "Technical Skills", experience: "Professional Experience", education: "Education", certifications: "Certifications" }
}

export function expectedResumeHeadings(document: ResumeDocument): string[] {
  const labels = resumeSectionLabels(document.language)
  return [
    ...(document.professionalSummary ? [labels.summary] : []),
    ...(document.skillGroups.length > 0 ? [labels.skills] : []),
    labels.experience,
    ...(document.education.length > 0 ? [labels.education] : []),
    ...(document.certifications.length > 0 ? [labels.certifications] : [])
  ]
}

export const atsCleanV1Css = `
@page { size: A4; margin: 15mm 16mm; }
* { box-sizing: border-box; }
html { background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.35; }
body { margin: 0 auto; max-width: 178mm; }
header { margin-bottom: 1rem; }
h1 { font-size: 20pt; line-height: 1.1; margin: 0 0 .2rem; }
h2 { border-bottom: 1px solid #333; font-size: 11.5pt; letter-spacing: .03em; margin: 1rem 0 .45rem; padding-bottom: .12rem; text-transform: uppercase; }
h3 { font-size: 10.8pt; margin: 0; }
p { margin: .2rem 0; }
ul { margin: .25rem 0 .55rem; padding-left: 1.15rem; }
li { margin: .12rem 0; }
a { color: #111; text-decoration: underline; }
.contact { display: flex; flex-wrap: wrap; gap: .25rem .7rem; }
.experience, .education-entry, .certification-entry { break-inside: avoid; page-break-inside: avoid; margin-bottom: .65rem; }
.experience-meta { display: flex; justify-content: space-between; gap: .75rem; }
.experience-meta time { white-space: nowrap; }
.skill-group { margin: .18rem 0; }
@media print { html, body { width: auto; max-width: none; } a { color: #111; } }
`.trim()
