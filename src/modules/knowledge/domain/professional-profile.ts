export const professionalProfileV1Schema = "professional-profile/v1" as const
export const professionalProfileLanguages = ["en", "pt-BR"] as const
export type ProfessionalProfileLanguage = typeof professionalProfileLanguages[number]

export const professionalProfileCandidateLabels = [
  "Name",
  "Headline",
  "Location",
  "Email",
  "Phone",
  "LinkedIn",
  "GitHub",
  "Website"
] as const

export type ProfessionalProfileCandidateLabel = typeof professionalProfileCandidateLabels[number]

export interface ProfessionalProfileV1Candidate {
  name: string
  headline?: string
  location?: string
  email?: string
  phone?: string
  linkedin?: string
  github?: string
  website?: string
}

export interface ProfessionalProfileV1Metadata {
  schema: typeof professionalProfileV1Schema
  language: ProfessionalProfileLanguage
  candidate: ProfessionalProfileV1Candidate
}

export type ProfessionalProfileValidationIssueCode =
  | "missing_frontmatter"
  | "unclosed_frontmatter"
  | "missing_schema"
  | "duplicate_schema"
  | "invalid_schema_type"
  | "unsupported_schema"
  | "missing_language"
  | "duplicate_language"
  | "invalid_language_type"
  | "unsupported_language"
  | "missing_candidate_section"
  | "duplicate_section"
  | "missing_candidate_name"
  | "duplicate_candidate_field"

export interface ProfessionalProfileValidationIssue {
  code: ProfessionalProfileValidationIssueCode
  path: string
  message: string
  value?: string
  line?: number
}

export class ProfessionalProfileValidationError extends Error {
  constructor(readonly issues: ProfessionalProfileValidationIssue[]) {
    super(`Canonical professional profile validation failed: ${issues.map((issue) => `${issue.code}@${issue.path}`).join(", ")}`)
    this.name = "ProfessionalProfileValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

export function readProfessionalProfileV1Metadata(value: unknown): ProfessionalProfileV1Metadata | undefined {
  if (!isRecord(value) || value.schema !== professionalProfileV1Schema || !professionalProfileLanguages.includes(value.language as ProfessionalProfileLanguage) || !isRecord(value.candidate)) return undefined
  const name = optionalString(value.candidate, "name")
  if (!name) return undefined
  return {
    schema: professionalProfileV1Schema,
    language: value.language as ProfessionalProfileLanguage,
    candidate: {
      name,
      ...(optionalString(value.candidate, "headline") ? { headline: optionalString(value.candidate, "headline") } : {}),
      ...(optionalString(value.candidate, "location") ? { location: optionalString(value.candidate, "location") } : {}),
      ...(optionalString(value.candidate, "email") ? { email: optionalString(value.candidate, "email") } : {}),
      ...(optionalString(value.candidate, "phone") ? { phone: optionalString(value.candidate, "phone") } : {}),
      ...(optionalString(value.candidate, "linkedin") ? { linkedin: optionalString(value.candidate, "linkedin") } : {}),
      ...(optionalString(value.candidate, "github") ? { github: optionalString(value.candidate, "github") } : {}),
      ...(optionalString(value.candidate, "website") ? { website: optionalString(value.candidate, "website") } : {})
    }
  }
}
