import {
  KnowledgeMetadata,
  KnowledgeMetadataProvider
} from "./ports/knowledge-metadata-provider.js";
import { PlannedQuery, QueryAst, RetrievalStrategy } from "./types.js";

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

function metadataMatches(semanticText: string, metadata: KnowledgeMetadata): string[] {
  const normalizedQuery = ` ${normalize(semanticText)} `;
  return unique(
    metadataTerms(metadata)
      .map(normalize)
      .filter((term) => term.length > 0)
      .filter((term) => normalizedQuery.includes(` ${term} `))
  );
}

function isExactMetadataQuery(semanticText: string, matchingMetadataTerms: string[]): boolean {
  const normalizedSemanticText = normalize(semanticText);
  return matchingMetadataTerms.some((term) => term === normalizedSemanticText);
}

export class QueryPlanner {
  constructor(private readonly metadataProvider: KnowledgeMetadataProvider) {}

  async plan(query: QueryAst): Promise<PlannedQuery> {
    const matchingMetadataTerms = query.semanticText.length > 0
      ? metadataMatches(query.semanticText, await this.metadataProvider.getMetadata())
      : [];
    const hasStructuredSignal = query.filters.length > 0 || matchingMetadataTerms.length > 0;
    const hasSemanticSignal = query.semanticText.length > 0
      && !isExactMetadataQuery(query.semanticText, matchingMetadataTerms);

    return {
      query: query.originalQuery,
      semanticText: query.semanticText,
      strategies: selectStrategies({ hasStructuredSignal, hasSemanticSignal }),
      structuredTerms: matchingMetadataTerms,
      filters: query.filters,
      diagnostics: query.diagnostics
    };
  }
}
