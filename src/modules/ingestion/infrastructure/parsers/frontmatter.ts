export interface MarkdownFrontmatterEntry {
  key: string
  kind: "scalar" | "sequence"
  value: string | string[]
  line: number
}

export interface ParsedMarkdownFrontmatter {
  present: boolean
  closed: boolean
  entries: MarkdownFrontmatterEntry[]
  metadata: Record<string, string | string[]>
  body: string
  bodyStartLine: number
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/u, "$2")
}

export function parseMarkdownFrontmatter(rawContent: string): ParsedMarkdownFrontmatter {
  const lines = rawContent.split(/\r?\n/u)
  if (lines[0] !== "---") {
    return { present: false, closed: false, entries: [], metadata: {}, body: rawContent, bodyStartLine: 1 }
  }

  const closingIndex = lines.slice(1).findIndex((line) => line === "---")
  if (closingIndex < 0) {
    const entries: MarkdownFrontmatterEntry[] = []
    const metadata: Record<string, string | string[]> = {}
    for (let index = 1; index < lines.length; index += 1) {
      const separator = lines[index].indexOf(":")
      if (separator < 0) continue
      const key = lines[index].slice(0, separator).trim()
      if (!key) continue
      const rawValue = lines[index].slice(separator + 1).trim()
      const value = rawValue.startsWith("[") && rawValue.endsWith("]")
        ? rawValue.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean)
        : unquote(rawValue)
      const kind = Array.isArray(value) ? "sequence" as const : "scalar" as const
      entries.push({ key, kind, value, line: index + 1 })
      metadata[key] = value
    }
    return { present: true, closed: false, entries, metadata, body: rawContent, bodyStartLine: 1 }
  }

  const absoluteClosingIndex = closingIndex + 1
  const entries: MarkdownFrontmatterEntry[] = []
  const metadata: Record<string, string | string[]> = {}
  for (let index = 1; index < absoluteClosingIndex; index += 1) {
    const line = lines[index]
    const separator = line.indexOf(":")
    if (separator < 0) continue
    const key = line.slice(0, separator).trim()
    if (!key) continue
    const rawValue = line.slice(separator + 1).trim()
    const value = rawValue.startsWith("[") && rawValue.endsWith("]")
      ? rawValue.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean)
      : unquote(rawValue)
    const kind = Array.isArray(value) ? "sequence" as const : "scalar" as const
    entries.push({ key, kind, value, line: index + 1 })
    metadata[key] = value
  }

  return {
    present: true,
    closed: true,
    entries,
    metadata,
    body: lines.slice(absoluteClosingIndex + 1).join("\n").replace(/^\n/u, ""),
    bodyStartLine: absoluteClosingIndex + 2
  }
}

export function claimsProfessionalProfileSchema(frontmatter: ParsedMarkdownFrontmatter): boolean {
  return frontmatter.entries
    .filter((entry) => entry.key === "schema")
    .flatMap((entry) => Array.isArray(entry.value) ? entry.value : [entry.value])
    .some((value) => value.startsWith("professional-profile/"))
}
