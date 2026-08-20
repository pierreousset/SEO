/**
 * Pure helpers for SEO keyword research (volume-backed ideas).
 * Network lives in lib/dataforseo.ts; this file stays unit-testable.
 */

export type KeywordIdeaSource = "ideas" | "site";

export type SeoKeywordIdea = {
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  competition: number | null;
  intent: string | null;
  source: KeywordIdeaSource;
  opportunityScore: number;
};

export type KeywordSeedInput = {
  primaryService?: string | null;
  secondaryServices?: string[];
  targetCities?: string[];
};

const INTENT_BOOST: Record<string, number> = {
  transactional: 1.35,
  commercial: 1.2,
  informational: 0.9,
  navigational: 0.4,
};

/** France-first market. Language follows the business profile. */
export function keywordMarket(preferredLanguage?: string | null): {
  locationCode: number;
  languageCode: string;
} {
  return {
    locationCode: 2250,
    languageCode: preferredLanguage === "en" ? "en" : "fr",
  };
}

function cleanSeed(s: string): string | null {
  const t = s.toLowerCase().trim().replace(/\s+/g, " ");
  if (t.length < 3 || t.length > 80) return null;
  return t;
}

/**
 * Seeds for DataForSEO keyword_ideas: services, plus service+city combos.
 * Brand names are not seeds — they produce navigational junk.
 */
export function buildKeywordSeeds(input: KeywordSeedInput): string[] {
  const services: string[] = [];
  const primary = input.primaryService ? cleanSeed(input.primaryService) : null;
  if (primary) services.push(primary);
  for (const s of input.secondaryServices ?? []) {
    const c = cleanSeed(s);
    if (c && !services.includes(c)) services.push(c);
  }

  const cities = (input.targetCities ?? [])
    .map((c) => cleanSeed(c))
    .filter((c): c is string => Boolean(c))
    .slice(0, 4);

  const out: string[] = [...services];
  if (primary) {
    for (const city of cities) {
      const combo = cleanSeed(`${primary} ${city}`);
      if (combo && !out.includes(combo)) out.push(combo);
    }
  }

  return out.slice(0, 12);
}

export function keywordOpportunityScore(opts: {
  searchVolume: number | null;
  keywordDifficulty: number | null;
  intent: string | null;
  wordCount: number;
}): number {
  const vol = opts.searchVolume ?? 0;
  if (vol <= 0) return 0;
  const kd = opts.keywordDifficulty ?? 50;
  const ease = Math.max(0.05, (100 - kd) / 100);
  const intentKey = (opts.intent ?? "").toLowerCase();
  const intentBoost = INTENT_BOOST[intentKey] ?? 1;
  const longtail = opts.wordCount >= 3 && vol < 2000 ? 1.15 : 1;
  return Math.round(vol * ease * intentBoost * longtail);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseLabsKeyword(
  item: unknown,
  source: KeywordIdeaSource,
): SeoKeywordIdea | null {
  if (!isRecord(item)) return null;
  const nested = isRecord(item.keyword_data) ? item.keyword_data : undefined;
  const keyword = String(item.keyword ?? nested?.keyword ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (keyword.length < 2) return null;

  const info = isRecord(item.keyword_info)
    ? item.keyword_info
    : isRecord(nested?.keyword_info)
      ? nested.keyword_info
      : {};
  const props = isRecord(item.keyword_properties)
    ? item.keyword_properties
    : isRecord(nested?.keyword_properties)
      ? nested.keyword_properties
      : {};
  const intentRaw = isRecord(item.search_intent_info)
    ? item.search_intent_info
    : isRecord(nested?.search_intent_info)
      ? nested.search_intent_info
      : {};
  const intent =
    typeof intentRaw.main_intent === "string" ? intentRaw.main_intent.toLowerCase() : null;
  const searchVolume = num(info.search_volume);
  const keywordDifficulty = num(props.keyword_difficulty);
  const wordCount = keyword.split(" ").filter(Boolean).length;

  return {
    keyword,
    searchVolume,
    keywordDifficulty,
    cpc: num(info.cpc),
    competition: num(info.competition),
    intent,
    source,
    opportunityScore: keywordOpportunityScore({
      searchVolume,
      keywordDifficulty,
      intent,
      wordCount,
    }),
  };
}

export function mergeKeywordIdeas(rows: SeoKeywordIdea[]): SeoKeywordIdea[] {
  const byKey = new Map<string, SeoKeywordIdea>();
  for (const row of rows) {
    const existing = byKey.get(row.keyword);
    if (!existing) {
      byKey.set(row.keyword, row);
      continue;
    }
    const better =
      row.opportunityScore > existing.opportunityScore
        ? row
        : existing.opportunityScore > row.opportunityScore
          ? existing
          : row.searchVolume != null &&
              (existing.searchVolume == null || row.searchVolume > existing.searchVolume)
            ? row
            : existing;
    byKey.set(row.keyword, {
      ...better,
      source: existing.source === row.source ? better.source : existing.source,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => b.opportunityScore - a.opportunityScore);
}
