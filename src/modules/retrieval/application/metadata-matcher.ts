import { KnowledgeMetadata, KnowledgeMetadataProvider } from "./ports/knowledge-metadata-provider.js";
import { MetadataMatcher } from "./ports/metadata-matcher.js";
import {
  MetadataCategory,
  MetadataMatch,
  MetadataMatchType,
  QueryAst
} from "./types.js";

interface MetadataCandidate {
  category: MetadataCategory;
  value: string;
  aliases: string[];
}

const metadataGroups: Array<{
  category: MetadataCategory;
  key: keyof Pick<
    KnowledgeMetadata,
    "skills" | "technologies" | "organizations" | "roles" | "projects" | "products" | "initiatives"
  >;
}> = [
  { category: "skill", key: "skills" },
  { category: "technology", key: "technologies" },
  { category: "organization", key: "organizations" },
  { category: "role", key: "roles" },
  { category: "project", key: "projects" },
  { category: "product", key: "products" },
  { category: "initiative", key: "initiatives" }
];

export function normalizeMetadataText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function aliasesFor(metadata: KnowledgeMetadata, category: MetadataCategory, value: string): string[] {
  return unique((metadata.aliases ?? [])
    .filter((alias) => alias.category === category && alias.value === value)
    .map((alias) => alias.alias));
}

function candidatesFromMetadata(metadata: KnowledgeMetadata): MetadataCandidate[] {
  const candidates = metadataGroups.flatMap(({ category, key }) =>
    metadata[key].map((value) => ({
      category,
      value,
      aliases: aliasesFor(metadata, category, value)
    }))
  );

  for (const company of metadata.companies ?? []) {
    candidates.push({
      category: "organization",
      value: company,
      aliases: aliasesFor(metadata, "organization", company)
    });
  }

  return candidates;
}

function matchValue(
  normalizedQuery: string,
  candidate: MetadataCandidate
): Pick<MetadataMatch, "matchType" | "matchedText" | "alias"> | undefined {
  const normalizedValue = normalizeMetadataText(candidate.value);
  if (normalizedValue.length === 0 || normalizedQuery.length === 0) {
    return undefined;
  }

  if (normalizedQuery === normalizedValue) {
    return { matchType: "exact", matchedText: candidate.value };
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return { matchType: "prefix", matchedText: candidate.value };
  }

  const paddedQuery = ` ${normalizedQuery} `;
  const paddedValue = ` ${normalizedValue} `;
  if (
    paddedQuery.includes(paddedValue)
    || normalizedQuery.includes(normalizedValue)
    || normalizedValue.includes(normalizedQuery)
  ) {
    return { matchType: "partial", matchedText: candidate.value };
  }

  for (const alias of candidate.aliases) {
    const normalizedAlias = normalizeMetadataText(alias);
    if (normalizedAlias.length === 0) {
      continue;
    }

    if (
      normalizedQuery === normalizedAlias
      || normalizedAlias.startsWith(normalizedQuery)
      || paddedQuery.includes(` ${normalizedAlias} `)
      || normalizedQuery.includes(normalizedAlias)
    ) {
      return { matchType: "alias", matchedText: alias, alias };
    }
  }

  return undefined;
}

function matchPriority(matchType: MetadataMatchType): number {
  switch (matchType) {
    case "exact":
      return 0;
    case "alias":
      return 1;
    case "prefix":
      return 2;
    case "partial":
      return 3;
  }
}

function deduplicate(matches: MetadataMatch[]): MetadataMatch[] {
  const byValue = new Map<string, MetadataMatch>();
  for (const match of matches) {
    const key = `${match.category}:${match.normalizedValue}`;
    const existing = byValue.get(key);
    if (existing === undefined || matchPriority(match.matchType) < matchPriority(existing.matchType)) {
      byValue.set(key, match);
    }
  }

  return Array.from(byValue.values()).sort((left, right) => {
    const priority = matchPriority(left.matchType) - matchPriority(right.matchType);
    if (priority !== 0) {
      return priority;
    }

    return `${left.category}:${left.normalizedValue}`.localeCompare(`${right.category}:${right.normalizedValue}`);
  });
}

export class KnowledgeMetadataMatcher implements MetadataMatcher {
  constructor(private readonly metadataProvider: KnowledgeMetadataProvider) {}

  async match(query: QueryAst): Promise<MetadataMatch[]> {
    const normalizedQuery = normalizeMetadataText(query.semanticText);
    if (normalizedQuery.length === 0) {
      return [];
    }

    const metadata = await this.metadataProvider.getMetadata();
    return deduplicate(candidatesFromMetadata(metadata).flatMap((candidate) => {
      const normalizedValue = normalizeMetadataText(candidate.value);
      const match = matchValue(normalizedQuery, candidate);
      return match === undefined
        ? []
        : [{
          category: candidate.category,
          value: candidate.value,
          normalizedValue,
          ...match
        }];
    }));
  }
}
