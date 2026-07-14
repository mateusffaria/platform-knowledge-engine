import {
  PkqlDateFilterField,
  pkqlFilterFields,
  PkqlFilterField,
  QueryDiagnostic,
  QueryAst,
  SearchFilter
} from "./types.js";

const supportedFields = new Set<string>(pkqlFilterFields);
const dateFields = new Set<PkqlDateFilterField>(["after", "before"]);
const filterPattern = /(?:^|\s)([A-Za-z][A-Za-z0-9_-]*):(?:"([^"]*)"|'([^']*)'|(\S*))/g;

export class PkqlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PkqlParseError";
  }
}

function normalizeSemanticText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseFilter(fieldName: string, rawValue: string, value: string): SearchFilter {
  const field = fieldName.toLowerCase();
  if (!supportedFields.has(field)) {
    throw new PkqlParseError(
      `Unsupported PKQL filter "${fieldName}". Supported filters: ${pkqlFilterFields.join(", ")}.`
    );
  }

  const parsedValue = value.trim();
  if (parsedValue.length === 0) {
    throw new PkqlParseError(`PKQL filter "${field}" requires a value.`);
  }

  if (dateFields.has(field as PkqlDateFilterField)) {
    if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(parsedValue)) {
      throw new PkqlParseError(`PKQL filter "${field}" expects YYYY, YYYY-MM, or YYYY-MM-DD.`);
    }

    return {
      field: field as PkqlDateFilterField,
      value: {
        kind: "date",
        value: parsedValue,
        rawValue
      }
    };
  }

  return {
    field: field as PkqlFilterField,
    value: {
      kind: "text",
      value: parsedValue,
      rawValue
    }
  };
}

export function parsePkqlQuery(input: string): QueryAst {
  const originalQuery = input.trim();
  if (originalQuery.length === 0) {
    throw new PkqlParseError("Retrieval query must not be empty.");
  }

  const filters: SearchFilter[] = [];
  const semanticParts: string[] = [];
  const semanticRanges: Array<{ start: number; value: string }> = [];
  const unquotedTextFilters: Array<{ end: number; field: string; value: string }> = [];
  let lastMatchEnd = 0;

  for (const match of originalQuery.matchAll(filterPattern)) {
    const matchIndex = match.index ?? 0;
    const semanticPart = originalQuery.slice(lastMatchEnd, matchIndex);
    semanticParts.push(semanticPart);
    semanticRanges.push({ start: lastMatchEnd, value: semanticPart });

    const fieldName = match[1];
    const rawValue = match[0].trim().slice(fieldName.length + 1);
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    const filter = parseFilter(fieldName, rawValue, value);
    const matchEnd = matchIndex + match[0].length;
    filters.push(filter);
    if (filter.value.kind === "text" && match[2] === undefined && match[3] === undefined) {
      unquotedTextFilters.push({ end: matchEnd, field: filter.field, value: filter.value.value });
    }
    lastMatchEnd = matchEnd;
  }

  const finalSemanticPart = originalQuery.slice(lastMatchEnd);
  semanticParts.push(finalSemanticPart);
  semanticRanges.push({ start: lastMatchEnd, value: finalSemanticPart });
  const semanticText = normalizeSemanticText(semanticParts.join(" "));
  if (filters.length === 0 && semanticText.length === 0) {
    throw new PkqlParseError("Retrieval query must not be empty.");
  }

  const diagnostics: QueryDiagnostic[] = unquotedTextFilters
    .filter((filter) => semanticRanges.some((range) => range.start >= filter.end && range.value.trim().length > 0))
    .map((filter) => ({
      message: `Unquoted PKQL filter "${filter.field}:${filter.value}" is followed by text that may be part of its value. Quote compound values, for example ${filter.field}:"${filter.value} ...".`
    }));

  return {
    originalQuery,
    semanticText,
    filters,
    diagnostics
  };
}
