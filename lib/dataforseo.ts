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
