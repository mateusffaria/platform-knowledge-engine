import {
  KnowledgeMetadata,
  KnowledgeMetadataProvider
} from "./ports/knowledge-metadata-provider.js";
import { PlannedQuery, RetrievalStrategy } from "./types.js";

const naturalLanguageTerms = new Set([
  "about",
  "any",
  "can",
  "did",
  "does",
  "for",
  "how",
  "of",
  "show",
  "that",
  "the",
  "what",
  "where",
  "which",
  "who",
  "with"
]);

const metadataGroups: Array<keyof KnowledgeMetadata> = [
  "skills",
  "technologies",
  "companies",
  "projects",
  "roles"
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(query: string): string[] {
  return normalize(query).match(/[a-z0-9+#.-]+/g) ?? [];
}

function hasDateLikeTerm(query: string): boolean {
  return /\b(19|20)\d{2}(?:-\d{2})?\b/i.test(query)
    || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i.test(query)
    || /\bpresent\b/i.test(query);
}

function hasQuotedTerm(query: string): boolean {
  return /"[^"]+"|'[^']+'/.test(query);
}

function hasCapitalizedPhrase(query: string): boolean {
  return /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(query);
}

function hasNaturalLanguageShape(query: string, tokens: string[]): boolean {
  return query.includes("?")
    || tokens.length >= 5
    || tokens.some((token) => naturalLanguageTerms.has(token));
}

function selectStrategies(input: {
  hasStructuredSignal: boolean;
  hasSemanticSignal: boolean;
}): RetrievalStrategy[] {
  if (input.hasStructuredSignal && input.hasSemanticSignal) {
    return ["structured", "semantic"];
  }

  if (input.hasStructuredSignal) {
    return ["structured"];
  }

  return ["semantic"];
}

function metadataTerms(metadata: KnowledgeMetadata): string[] {
  return metadataGroups.flatMap((group) => metadata[group]);
}

function metadataMatches(query: string, metadata: KnowledgeMetadata): string[] {
  const normalizedQuery = ` ${normalize(query)} `;
  return unique(
    metadataTerms(metadata)
      .map(normalize)
      .filter((term) => term.length > 0)
      .filter((term) => normalizedQuery.includes(` ${term} `))
  );
}

function genericStructuredTerms(query: string, tokens: string[]): string[] {
  const terms: string[] = [];

  if (hasDateLikeTerm(query)) {
    terms.push(...tokens.filter((token) => /\b(19|20)\d{2}(?:-\d{2})?\b/.test(token) || token === "present"));
  }

  if (hasQuotedTerm(query) || hasCapitalizedPhrase(query)) {
    terms.push(...tokens.filter((token) => token.length >= 3));
  }

  return unique(terms);
}

export class QueryPlanner {
  constructor(private readonly metadataProvider: KnowledgeMetadataProvider) {}

  async plan(rawQuery: string): Promise<PlannedQuery> {
    const query = rawQuery.trim();
    if (query.length === 0) {
      throw new Error("Retrieval query must not be empty.");
    }

    const tokens = tokenize(query);
    const metadata = await this.metadataProvider.getMetadata();
    const matchingMetadataTerms = metadataMatches(query, metadata);
    const structuredTerms = unique([
      ...matchingMetadataTerms,
      ...genericStructuredTerms(query, tokens)
    ]);
    const hasStructuredSignal = structuredTerms.length > 0;
    const hasSemanticSignal = hasNaturalLanguageShape(query, tokens);

    return {
      query,
      strategies: selectStrategies({ hasStructuredSignal, hasSemanticSignal }),
      structuredTerms
    };
  }
}
