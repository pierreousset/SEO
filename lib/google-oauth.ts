import { google } from "googleapis";

/**
 * Google OAuth for Google Search Console API access.
 *
 * This is SEPARATE from app authentication (Better Auth / OTP email).
 * The access token here lets us call GSC APIs on behalf of the user.
 * The refresh token is stored encrypted in gsc_tokens table.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(state: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token each time
    scope: [SCOPE],
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token received from Google. User may have previously authorized without re-consent.");
  }
  return tokens;
}

export async function getSearchConsoleClient(refreshToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return google.searchconsole({ version: "v1", auth: client });
}

/**
 * List verified GSC properties for this user.
 * Properties come in two formats:
 *   - URL-prefix:   https://example.com/
 *   - Domain:       sc-domain:example.com
 */
export async function listSites(refreshToken: string) {
  const sc = await getSearchConsoleClient(refreshToken);
  const res = await sc.sites.list();
  return (res.data.siteEntry ?? []).filter(
    (s) => s.permissionLevel !== "siteUnverifiedUser",
  );
}

/**
 * Fetch top N queries (search keywords) for a property over the past 28 days.
 * Returns sorted by clicks descending.
 */
export async function fetchTopQueries(
  refreshToken: string,
  siteUrl: string,
  limit = 20,
): Promise<Array<{ query: string; clicks: number; impressions: number; position: number }>> {
  const sc = await getSearchConsoleClient(refreshToken);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3); // GSC has ~2-3 day lag
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 28);

  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query"],
      rowLimit: limit,
      // GSC default ordering is by clicks descending — no orderBy field exists.
    },
  });

  const rows = res.data.rows ?? [];
  return rows
    .map((r) => ({
      query: (r.keys?.[0] ?? "").toString(),
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

/**
 * Convert a GSC siteUrl into a bare domain we can match in SERP results.
 *   "sc-domain:example.com"   → "example.com"
 *   "https://www.example.com/" → "example.com"
 */
export function siteUrlToDomain(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).toLowerCase();
  }
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return siteUrl.replace(/^www\./, "").toLowerCase();
  }
}

/**
 * Pull GSC site-wide daily totals (all queries, all pages aggregated).
 * Used for the "All site" view of the performance chart, matching what
 * Search Console shows by default.
 */
export async function fetchGscSiteTotals(
  refreshToken: string,
  siteUrl: string,
  days = 90,
): Promise<
  Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>
> {
  const sc = await getSearchConsoleClient(refreshToken);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["date"],
      rowLimit: 1000, // 365 days max anyway
    },
  });

  return (res.data.rows ?? []).map((r) => ({
    date: (r.keys?.[0] ?? "").toString(),
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/**
 * Pull GSC daily metrics for a list of tracked queries.
 *
 * Returns one row per (query, date) with clicks, impressions, CTR (0-1), avg position.
 * GSC has 16 months of history with ~2-3 day data lag. Rate limit: ~1200 queries/min.
 *
 * Strategy: GSC Search Analytics only supports `groupType: "and"` for filter groups,
 * so we can't OR multiple query filters in one call. Instead we pull ALL queries
 * unfiltered (paginated, max 25k rows per page) and filter client-side to the
 * tracked queries set. Caps at 100k rows total (safety guard).
 */
export async function fetchGscHistoryByQuery(
  refreshToken: string,
  siteUrl: string,
  queries: string[],
  days = 90,
): Promise<
  Array<{
    query: string;
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>
> {
  if (queries.length === 0) return [];

  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const wanted = new Set(queries.map(norm));

  const sc = await getSearchConsoleClient(refreshToken);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const all: Array<{
    query: string;
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }> = [];

  let startRow = 0;
  const PAGE = 25000;
  const MAX_ROWS = 100000; // safety stop — covers ~99% of indie sites over 90d

  while (startRow < MAX_ROWS) {
    const res = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query", "date"],
        rowLimit: PAGE,
        startRow,
      },
    });

    const rows = res.data.rows ?? [];
    for (const r of rows) {
      const q = (r.keys?.[0] ?? "").toString();
      if (!wanted.has(norm(q))) continue;
      all.push({
        query: q,
        date: (r.keys?.[1] ?? "").toString(),
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
    }

    if (rows.length < PAGE) break;
    startRow += PAGE;
  }

  return all;
}
