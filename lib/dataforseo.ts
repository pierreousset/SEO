/**
 * DataForSEO Standard (queued) SERP API client.
 *
 * Standard API is queue-based: POST a task, then poll /tasks_ready and GET the result.
 * For Live API (instant, 5x more expensive), swap "standard" endpoints for "live/regular".
 *
 * Pricing (Standard): ~$0.0006 per SERP query.
 * Rate limit: 2000 calls / minute per account.
 *
 * Auth: HTTP Basic, login + password (NOT bearer).
 */

import {
  parseLabsKeyword,
  type SeoKeywordIdea,
} from "@/lib/seo/keyword-ideas";

const BASE = "https://api.dataforseo.com/v3";

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set");
  }
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

export type SerpTask = {
  keyword: string;
  language_code?: string; // default "fr"
  location_code?: number; // default 2250 (France). 2840 = US.
  device?: "desktop" | "mobile";
  depth?: number; // 10 | 20 | 50 | 100. Default 100 to find any rank.
};

export type SerpResult = {
  keyword: string;
  position: number | null; // null = not in top N
  url: string | null;
  fetchedAt: string;
};

/** Post a batch of SERP tasks. Returns task IDs. */
export async function postSerpTasks(tasks: SerpTask[], targetDomain: string): Promise<string[]> {
  const body = tasks.map((t) => ({
    keyword: t.keyword,
    language_code: t.language_code ?? "fr",
    location_code: t.location_code ?? 2250,
    device: t.device ?? "desktop",
    depth: t.depth ?? 100,
    target: targetDomain, // DataForSEO will mark ranked results for this domain
  }));

  const res = await fetch(`${BASE}/serp/google/organic/task_post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DataForSEO task_post failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const tasksResp = (json.tasks as any[]) || [];
  return tasksResp.map((t) => t.id as string).filter(Boolean);
}

function findBestRanked(items: any[], domain: string): { position: number | null; url: string | null } {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  const match = items
    .filter((i) => i.type === "organic" && typeof i.url === "string")
    .find((i) => {
      try {
        const host = new URL(i.url).hostname.replace(/^www\./, "").toLowerCase();
        return host === normalized || host.endsWith("." + normalized);
      } catch {
        return false;
      }
    });
  return {
    position: match ? (match.rank_absolute as number) : null,
    url: match ? (match.url as string) : null,
  };
}

/** Fetch one completed task's result. Returns the best-ranked URL for targetDomain. */
export async function fetchTaskResult(taskId: string, targetDomain: string): Promise<SerpResult | null> {
  const multi = await fetchTaskResultMulti(taskId, [targetDomain]);
  if (!multi) return null;
  return {
    keyword: multi.keyword,
    fetchedAt: multi.fetchedAt,
    ...multi.byDomain[targetDomain.replace(/^www\./, "").toLowerCase()],
  };
}

/**
 * Fetch a task's result and extract positions for multiple domains in one pass.
 * Same SERP, same cost — we just look at more URLs. Used for competitor tracking.
 */
export async function fetchTaskResultMulti(
  taskId: string,
  domains: string[],
): Promise<{
  keyword: string;
  fetchedAt: string;
  byDomain: Record<string, { position: number | null; url: string | null }>;
} | null> {
  const res = await fetch(`${BASE}/serp/google/organic/task_get/regular/${taskId}`, {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    throw new Error(`DataForSEO task_get failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const task = json.tasks?.[0];
  if (!task || !task.result?.[0]) return null;

  const result = task.result[0];
  const keyword = result.keyword as string;
  const items = (result.items as any[]) || [];

  const byDomain: Record<string, { position: number | null; url: string | null }> = {};
  for (const d of domains) {
    const key = d.replace(/^www\./, "").toLowerCase();
    byDomain[key] = findBestRanked(items, d);
  }

  return { keyword, fetchedAt: new Date().toISOString(), byDomain };
}

/** Strip protocol/www to get a bare host. "https://foo.com/path" → "foo.com" */
export function urlToDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .toLowerCase();
  }
}

/**
 * DataForSEO Labs — Ranked Keywords for a domain.
 *
 * Returns all organic keywords a domain ranks for, with search volume,
 * current position, URL, CPC, etc. Used for competitor gap discovery:
 * find keywords where a competitor ranks but you don't.
 *
 * Pricing: Live endpoint costs ~$0.0005 per returned keyword.
 * For 3 competitors × 500 top keywords each = ~$0.75 per sync.
 */
export type RankedKeyword = {
  keyword: string;
  searchVolume: number | null;
  competitorPosition: number | null;
  competitorUrl: string | null;
  cpc: number | null;
  keywordDifficulty: number | null;
};

export async function fetchCompetitorRankedKeywords(
  domain: string,
  opts: { limit?: number; locationCode?: number; languageCode?: string } = {},
): Promise<RankedKeyword[]> {
  const body = [
    {
      target: domain,
      location_code: opts.locationCode ?? 2250, // 2250 = France, 2840 = US
      language_code: opts.languageCode ?? "fr",
      limit: opts.limit ?? 500,
      order_by: ["ranked_serp_element.serp_item.rank_group,asc"],
      filters: [
        ["ranked_serp_element.serp_item.rank_group", "<=", 30],
        "and",
        ["keyword_data.keyword_info.search_volume", ">=", 10],
      ],
    },
  ];

  const res = await fetch(
    `${BASE}/dataforseo_labs/google/ranked_keywords/live`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`DataForSEO ranked_keywords failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const items = (json.tasks?.[0]?.result?.[0]?.items ?? []) as any[];

  return items.map((i: any) => {
    const kwInfo = i?.keyword_data?.keyword_info ?? {};
    const serp = i?.ranked_serp_element?.serp_item ?? {};
    return {
      keyword: (i?.keyword_data?.keyword ?? "").toString(),
      searchVolume: typeof kwInfo.search_volume === "number" ? kwInfo.search_volume : null,
      competitorPosition: typeof serp.rank_group === "number" ? serp.rank_group : null,
      competitorUrl: (serp.url ?? null) as string | null,
      cpc: typeof kwInfo.cpc === "number" ? kwInfo.cpc : null,
      keywordDifficulty:
        typeof i?.keyword_data?.keyword_properties?.keyword_difficulty === "number"
          ? i.keyword_data.keyword_properties.keyword_difficulty
          : null,
    };
  });
}

async function labsLiveItems(path: string, body: unknown[]): Promise<unknown[]> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`DataForSEO ${path} failed: ${res.status} ${await res.text()}`);
  }
  const json: unknown = await res.json();
  const task =
    typeof json === "object" && json !== null && "tasks" in json
      ? (json as { tasks?: unknown }).tasks
      : undefined;
  const first = Array.isArray(task) ? task[0] : undefined;
  const statusCode =
    typeof first === "object" && first !== null && "status_code" in first
      ? (first as { status_code?: unknown }).status_code
      : undefined;
  const statusMessage =
    typeof first === "object" && first !== null && "status_message" in first
      ? (first as { status_message?: unknown }).status_message
      : undefined;
  if (typeof statusCode === "number" && statusCode >= 40000) {
    throw new Error(typeof statusMessage === "string" ? statusMessage : `DataForSEO ${path} error`);
  }
  const result =
    typeof first === "object" && first !== null && "result" in first
      ? (first as { result?: unknown }).result
      : undefined;
  const firstResult = Array.isArray(result) ? result[0] : undefined;
  const items =
    typeof firstResult === "object" && firstResult !== null && "items" in firstResult
      ? (firstResult as { items?: unknown }).items
      : undefined;
  return Array.isArray(items) ? items : [];
}

/**
 * Keyword ideas from seed terms (Google Ads + DataForSEO Labs).
 * Volume, CPC, competition, difficulty — not GSC impressions.
 */
export async function fetchKeywordIdeas(
  seeds: string[],
  opts: { limit?: number; locationCode?: number; languageCode?: string; minVolume?: number } = {},
): Promise<SeoKeywordIdea[]> {
  const keywords = seeds.map((s) => s.trim()).filter((s) => s.length >= 3).slice(0, 20);
  if (keywords.length === 0) return [];

  const items = await labsLiveItems("/dataforseo_labs/google/keyword_ideas/live", [
    {
      keywords,
      location_code: opts.locationCode ?? 2250,
      language_code: opts.languageCode ?? "fr",
      closely_variants: true,
      include_serp_info: false,
      limit: opts.limit ?? 200,
      filters: [["keyword_info.search_volume", ">=", opts.minVolume ?? 10]],
      order_by: ["keyword_info.search_volume,desc"],
    },
  ]);

  return items
    .map((i) => parseLabsKeyword(i, "ideas"))
    .filter((row): row is SeoKeywordIdea => row != null);
}

/**
 * Keywords relevant to a domain (same category as the site in Google Ads).
 * Complements seed ideas when the business profile is thin.
 */
export async function fetchKeywordsForSite(
  domain: string,
  opts: { limit?: number; locationCode?: number; languageCode?: string; minVolume?: number } = {},
): Promise<SeoKeywordIdea[]> {
  const target = domain.replace(/^www\./, "").toLowerCase();
  if (!target) return [];

  const items = await labsLiveItems("/dataforseo_labs/google/keywords_for_site/live", [
    {
      target,
      location_code: opts.locationCode ?? 2250,
      language_code: opts.languageCode ?? "fr",
      include_serp_info: false,
      include_subdomains: true,
      limit: opts.limit ?? 200,
      filters: [["keyword_info.search_volume", ">=", opts.minVolume ?? 10]],
      order_by: ["relevance,desc", "keyword_info.search_volume,desc"],
    },
  ]);

  return items
    .map((i) => parseLabsKeyword(i, "site"))
    .filter((row): row is SeoKeywordIdea => row != null);
}

export type SearchVolumeRow = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
};

/**
 * Google Ads search volume for an exact list of keywords.
 * One request can cover up to 1,000 terms.
 */
export async function fetchSearchVolume(
  keywords: string[],
  opts: { locationCode?: number; languageCode?: string } = {},
): Promise<SearchVolumeRow[]> {
  const list = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))].slice(
    0,
    1000,
  );
  if (list.length === 0) return [];

  const res = await fetch(`${BASE}/keywords_data/google_ads/search_volume/live`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify([
      {
        keywords: list,
        location_code: opts.locationCode ?? 2250,
        language_code: opts.languageCode ?? "fr",
      },
    ]),
  });
  if (!res.ok) {
    throw new Error(`DataForSEO search_volume failed: ${res.status} ${await res.text()}`);
  }
  const json: unknown = await res.json();
  const task =
    typeof json === "object" && json !== null && "tasks" in json
      ? (json as { tasks?: unknown }).tasks
      : undefined;
  const first = Array.isArray(task) ? task[0] : undefined;
  const statusCode =
    typeof first === "object" && first !== null && "status_code" in first
      ? (first as { status_code?: unknown }).status_code
      : undefined;
  if (typeof statusCode === "number" && statusCode >= 40000) {
    const msg =
      typeof first === "object" && first !== null && "status_message" in first
        ? (first as { status_message?: unknown }).status_message
        : undefined;
    throw new Error(typeof msg === "string" ? msg : "DataForSEO search_volume error");
  }
  const result =
    typeof first === "object" && first !== null && "result" in first
      ? (first as { result?: unknown }).result
      : undefined;
  const rows = Array.isArray(result) ? result : [];
  const out: SearchVolumeRow[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const rec = row as Record<string, unknown>;
    const keyword = String(rec.keyword ?? "")
      .trim()
      .toLowerCase();
    if (!keyword) continue;
    out.push({
      keyword,
      searchVolume: typeof rec.search_volume === "number" ? rec.search_volume : null,
      cpc: typeof rec.cpc === "number" ? rec.cpc : null,
    });
  }
  return out;
}

/** Check which posted tasks are ready. Returns IDs that are ready to fetch. */
export async function listReadyTasks(): Promise<string[]> {
  const res = await fetch(`${BASE}/serp/google/organic/tasks_ready`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const results = json.tasks?.[0]?.result as any[] | undefined;
  return (results || []).map((r) => r.id as string);
}
