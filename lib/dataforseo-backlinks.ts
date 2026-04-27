/**
 * DataForSEO Backlinks API wrapper.
 *
 * Three endpoints we care about:
 *   - /backlinks/summary/live       → aggregate numbers (total links, ref domains, DR)
 *   - /backlinks/backlinks/live     → list of individual backlinks
 *   - /backlinks/referring_domains/live → aggregated per referring domain
 *
 * All three return JSON with `tasks[0].result[0].items` shape. We normalize
 * into plain objects the rest of the app can use without knowing the raw shape.
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

async function post(path: string, body: any): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000), // 60s — backlinks can be heavy
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = await res.json();

  // DataForSEO returns HTTP 200 even when the task itself failed (e.g. plan
  // doesn't include this endpoint, rate-limited, bad target). Surface it.
  const task = json?.tasks?.[0];
  if (!task) {
    throw new Error(`DataForSEO ${path}: no task in response`);
  }
  const statusCode = task.status_code;
  // 20000 = success. Anything else = error (40xxx = auth/plan, 50xxx = server).
  if (statusCode !== 20000) {
    throw new Error(
      `DataForSEO ${path}: task failed (${statusCode}) ${String(task.status_message ?? "unknown").slice(0, 200)}`,
    );
  }
  return json;
}

// ---------------------------------------------------------------------------

export type BacklinkSummary = {
  totalBacklinks: number;
  referringDomains: number;
  referringPages: number;
  dofollowBacklinks: number;
  nofollowBacklinks: number;
  avgRefDomainRank: number | null; // DataForSEO's rank 0-1000
  brokenBacklinks: number;
};

export async function fetchBacklinkSummary(domain: string): Promise<BacklinkSummary> {
  const body = [
    {
      target: domain,
      internal_list_limit: 10,
      include_subdomains: true,
      include_indirect_links: false,
    },
  ];
  const json = await post("/backlinks/summary/live", body);
  const item = json.tasks?.[0]?.result?.[0] ?? {};

  return {
    totalBacklinks: typeof item.backlinks === "number" ? item.backlinks : 0,
    referringDomains: typeof item.referring_domains === "number" ? item.referring_domains : 0,
    referringPages: typeof item.referring_pages === "number" ? item.referring_pages : 0,
    dofollowBacklinks:
      typeof item.referring_links_attributes?.dofollow === "number"
        ? item.referring_links_attributes.dofollow
        : 0,
    nofollowBacklinks:
      typeof item.referring_links_attributes?.nofollow === "number"
        ? item.referring_links_attributes.nofollow
        : 0,
    avgRefDomainRank:
      typeof item.rank === "number" ? item.rank : null,
    brokenBacklinks:
      typeof item.broken_backlinks === "number" ? item.broken_backlinks : 0,
  };
}

// ---------------------------------------------------------------------------

export type Backlink = {
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchor: string | null;
  dofollow: boolean;
  firstSeen: string | null; // ISO
  lastSeen: string | null; // ISO
  domainRank: number | null; // 0-1000
  pageRank: number | null; // 0-1000
  isNew: boolean; // DataForSEO flag
  isLost: boolean;
};

export async function fetchBacklinks(
  domain: string,
  limit = 100,
): Promise<Backlink[]> {
  const body = [
    {
      target: domain,
      mode: "as_is", // keep raw, no dedupe on referring_domain
      include_subdomains: true,
      backlinks_status_type: "live",
      limit,
      order_by: ["rank,desc"],
    },
  ];
  const json = await post("/backlinks/backlinks/live", body);
  const items = (json.tasks?.[0]?.result?.[0]?.items ?? []) as any[];

  return items.map((i: any) => ({
    sourceUrl: (i.url_from ?? "").toString(),
    sourceDomain: (i.domain_from ?? "").toString(),
    targetUrl: (i.url_to ?? "").toString(),
    anchor: (i.anchor ?? null) as string | null,
    dofollow: i.dofollow === true,
    firstSeen: i.first_seen ?? null,
    lastSeen: i.last_seen ?? null,
    domainRank: typeof i.rank === "number" ? i.rank : null,
    pageRank: typeof i.page_from_rank === "number" ? i.page_from_rank : null,
    isNew: i.is_new === true,
    isLost: i.is_lost === true,
  }));
}

// ---------------------------------------------------------------------------

export type ReferringDomain = {
  domain: string;
  backlinks: number;
  firstSeen: string | null;
  lastSeen: string | null;
  rank: number | null;
  dofollowBacklinks: number;
  isNew: boolean;
  isLost: boolean;
};

export async function fetchReferringDomains(
  domain: string,
  limit = 100,
): Promise<ReferringDomain[]> {
  const body = [
    {
      target: domain,
      include_subdomains: true,
      backlinks_status_type: "live",
      limit,
      order_by: ["rank,desc"],
    },
  ];
  const json = await post("/backlinks/referring_domains/live", body);
  const items = (json.tasks?.[0]?.result?.[0]?.items ?? []) as any[];

  return items.map((i: any) => ({
    domain: (i.domain ?? "").toString(),
    backlinks: typeof i.backlinks === "number" ? i.backlinks : 0,
    firstSeen: i.first_seen ?? null,
    lastSeen: i.last_seen ?? null,
    rank: typeof i.rank === "number" ? i.rank : null,
    dofollowBacklinks:
      typeof i.referring_links_types?.dofollow === "number"
        ? i.referring_links_types.dofollow
        : 0,
    isNew: i.is_new === true,
    isLost: i.is_lost === true,
  }));
}
