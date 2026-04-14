/**
 * Lightweight page fetcher for the audit. Uses a short timeout and a custom
 * User-Agent so sites can identify our bot. Returns enough metadata for the
 * checks layer to evaluate each page.
 */
export type FetchedPage = {
  url: string;
  status: number;
  responseMs: number;
  bytes: number;
  html: string;
  finalUrl: string; // after redirects
  rendered: boolean; // true if HTML is post-JS execution
};

const UA =
  "Mozilla/5.0 (compatible; SEODashboardAuditBot/1.0; +https://seo-dashboard.local/audit)";

const RENDERED_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEODashboardAuditBot";

export async function fetchPage(url: string): Promise<FetchedPage> {
  const start = Date.now();
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8" },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  const html = await res.text();
  const responseMs = Date.now() - start;
  return {
    url,
    finalUrl: res.url || url,
    status: res.status,
    responseMs,
    bytes: html.length,
    html,
    rendered: false,
  };
}

/**
 * Fetch a page with full JS execution via Playwright (Chromium headless).
 * Returns the post-hydration HTML — what Google sees after rendering.
 *
 * Slow (~5-8s per page including browser startup) and requires Chromium binary
 * (`bunx playwright install chromium` once). For each audit run we share a
 * single browser instance and reuse it across pages.
 *
 * NOTE: this won't work in serverless prod (Vercel function size limits).
 * For prod, swap to puppeteer-core + @sparticuz/chromium, or a managed service
 * like ScrapingBee / Browserless. For local dev (Inngest CLI) it works fine.
 */
export async function fetchPageRendered(
  url: string,
  options: { browser?: import("playwright").Browser } = {},
): Promise<FetchedPage> {
  const { chromium } = await import("playwright");
  const start = Date.now();
  const browser = options.browser ?? (await chromium.launch({ headless: true }));
  const ownsBrowser = !options.browser;

  try {
    const context = await browser.newContext({
      userAgent: RENDERED_UA,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    // Small extra wait for late-injected scripts (analytics, schema)
    await page.waitForTimeout(1500);
    const html = await page.content();
    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    await context.close();

    return {
      url,
      finalUrl,
      status,
      responseMs: Date.now() - start,
      bytes: html.length,
      html,
      rendered: true,
    };
  } finally {
    if (ownsBrowser) await browser.close();
  }
}

/**
 * Run a batch of URL fetches with one shared Playwright browser instance.
 * Saves the ~3-4s startup cost per page.
 */
export async function fetchPagesRendered(urls: string[]): Promise<FetchedPage[]> {
  if (urls.length === 0) return [];
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const out: FetchedPage[] = [];
    for (const url of urls) {
      try {
        out.push(await fetchPageRendered(url, { browser }));
      } catch (e: any) {
        out.push({
          url,
          finalUrl: url,
          status: 0,
          responseMs: 0,
          bytes: 0,
          html: "",
          rendered: true,
        });
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

/**
 * Discover URLs to audit. Strategy:
 *   1. Try sitemap.xml (parse <loc> entries)
 *   2. Fallback to homepage + ad-hoc URLs caller passes
 *
 * Returns a deduped, normalized list. Caller decides how many to audit.
 */
export async function discoverUrls(homepageUrl: string, max = 10): Promise<string[]> {
  let origin = "";
  try {
    const u = new URL(homepageUrl);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return [homepageUrl];
  }

  const urls = new Set<string>([homepageUrl]);

  try {
    const res = await fetch(`${origin}/sitemap.xml`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const xml = await res.text();
      // Naive but fast: extract <loc>...</loc> entries
      const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g);
      for (const m of matches) {
        urls.add(m[1].trim());
        if (urls.size >= max) break;
      }
    }
  } catch {
    // sitemap missing or unreachable — that's ok, we'll just audit homepage
  }

  return Array.from(urls).slice(0, max);
}
