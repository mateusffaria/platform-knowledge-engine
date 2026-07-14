import { MetadataMatch, PlannedQuery, QueryAst, RetrievalStrategy } from "./types.js";

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
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

function structuredTerms(metadataMatches: MetadataMatch[]): string[] {
  return unique(metadataMatches.map((match) => match.normalizedValue));
}

export class QueryPlanner {
  plan(query: QueryAst, metadataMatches: MetadataMatch[] = []): PlannedQuery {
    const matchingMetadataTerms = structuredTerms(metadataMatches);
    const hasStructuredSignal = query.filters.length > 0 || metadataMatches.length > 0;
    const hasSemanticSignal = query.semanticText.length > 0
      && !metadataMatches.some((match) => match.matchType === "exact");

    return {
      query: query.originalQuery,
      semanticText: query.semanticText,
      strategies: selectStrategies({ hasStructuredSignal, hasSemanticSignal }),
      metadataMatches,
      structuredTerms: matchingMetadataTerms,
      filters: query.filters,
      diagnostics: query.diagnostics
    };
  }
}
