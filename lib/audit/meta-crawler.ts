/**
 * Full-site meta crawler. Separate from the audit (which crawls ~10 pages).
 *
 * Strategy:
 *   1. Parse sitemap.xml (no URL limit) to build the sitemap set
 *   2. Crawl every sitemap URL (SSR only — fast, ~200ms/page)
 *   3. Extract metas + all internal links from each page
 *   4. Discover pages linked but NOT in sitemap (orphans)
 *   5. Crawl those orphans too
 *   6. Return the full page inventory with coverage flags
 */

import * as cheerio from "cheerio";
import { extractPageMeta, type PageMeta } from "./checks";
import { fetchPage, type FetchedPage } from "./crawler";

export type CrawledPage = PageMeta & {
  httpStatus: number;
  responseMs: number;
  inSitemap: boolean;
  internalLinksOut: string[]; // URLs this page links to internally
};

/**
 * Parse ALL <loc> entries from sitemap.xml (+ sitemap index if present).
 * No URL limit — this is the full inventory.
 */
export async function parseSitemapUrls(homepageUrl: string): Promise<Set<string>> {
  const urls = new Set<string>();
  let origin = "";
  try {
    const u = new URL(homepageUrl);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return urls;
  }

  const UA = "Mozilla/5.0 (compatible; SEODashboardBot/1.0)";

  async function parseSitemap(sitemapUrl: string) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return;
      const xml = await res.text();

      // Check if this is a sitemap index (contains <sitemap> entries)
      const sitemapRefs = [...xml.matchAll(/<sitemap>\s*<loc>\s*([^<\s]+)\s*<\/loc>/g)];
      if (sitemapRefs.length > 0) {
        // Recursively parse child sitemaps (limit to 20 to be safe)
        for (const ref of sitemapRefs.slice(0, 20)) {
          await parseSitemap(ref[1].trim());
        }
        return;
      }

      // Regular sitemap — extract <loc> entries
      for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        const loc = m[1].trim();
        // Only include same-origin URLs
        try {
          const u = new URL(loc);
          if (u.origin === origin) urls.add(loc);
        } catch {}
      }
    } catch {
      // sitemap unreachable — that's fine
    }
  }

  await parseSitemap(`${origin}/sitemap.xml`);
  return urls;
}

/**
 * Extract all internal links from an HTML page.
 */
export function extractInternalLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  let host = "";
  let origin = "";
  try {
    const u = new URL(pageUrl);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    origin = u.origin;
  } catch {
    return [];
  }

  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Skip anchors, mailto, tel, javascript
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

    try {
      const resolved = new URL(href, pageUrl);
      const resolvedHost = resolved.hostname.replace(/^www\./, "").toLowerCase();
      if (resolvedHost === host) {
        // Normalize: strip hash, keep path + search
        resolved.hash = "";
        links.add(resolved.href);
      }
    } catch {}
  });

  return Array.from(links);
}

/**
 * Crawl a batch of URLs (SSR only), extract metas + internal links.
 * Concurrency: 5 at a time to avoid hammering the site.
 */
export async function crawlPages(
  urls: string[],
  sitemapSet: Set<string>,
): Promise<CrawledPage[]> {
  const results: CrawledPage[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const fetched = await Promise.allSettled(batch.map((u) => fetchPage(u)));

    for (let j = 0; j < batch.length; j++) {
      const url = batch[j];
      const result = fetched[j];

      if (result.status === "rejected") {
        results.push({
          url,
          title: null,
          titleLength: 0,
          metaDescription: null,
          metaDescriptionLength: 0,
          h1: null,
          canonical: null,
          ogTitle: null,
          ogDescription: null,
          ogImage: null,
          wordCount: 0,
          indexable: false,
          httpStatus: 0,
          responseMs: 0,
          inSitemap: sitemapSet.has(url),
          internalLinksOut: [],
        });
        continue;
      }

      const page = result.value;
      const meta = extractPageMeta(page.finalUrl, page.html);
      const internalLinks = extractInternalLinks(page.html, page.finalUrl);

      results.push({
        ...meta,
        url: page.finalUrl,
        httpStatus: page.status,
        responseMs: page.responseMs,
        inSitemap: sitemapSet.has(url) || sitemapSet.has(page.finalUrl),
        internalLinksOut: internalLinks,
      });
    }
  }

  return results;
}

/**
 * Run the full meta crawl:
 *   1. Parse sitemap
 *   2. Crawl all sitemap URLs
 *   3. Discover orphan pages (linked but not in sitemap)
 *   4. Crawl orphans
 *   5. Return everything
 */
export async function runFullMetaCrawl(homepageUrl: string): Promise<{
  pages: CrawledPage[];
  sitemapUrlCount: number;
  orphanCount: number;
}> {
  // Step 1: parse sitemap
  const sitemapSet = await parseSitemapUrls(homepageUrl);

  // Always include homepage
  const allUrls = new Set<string>(sitemapSet);
  allUrls.add(homepageUrl);

  // Step 2: crawl sitemap pages
  const crawled = await crawlPages(Array.from(allUrls), sitemapSet);

  // Step 3: discover pages linked from crawled pages but not in sitemap
  const crawledUrls = new Set(crawled.map((p) => p.url));
  const orphanUrls = new Set<string>();
  for (const page of crawled) {
    for (const link of page.internalLinksOut) {
      if (!crawledUrls.has(link) && !allUrls.has(link)) {
        orphanUrls.add(link);
      }
    }
  }

  // Step 4: crawl orphans
  if (orphanUrls.size > 0) {
    // Cap orphan discovery at 50 to avoid runaway crawls
    const orphanList = Array.from(orphanUrls).slice(0, 50);
    const orphanPages = await crawlPages(orphanList, sitemapSet);
    crawled.push(...orphanPages);
  }

  // Build reverse link map (who links to whom)
  const reverseLinks = new Map<string, string[]>();
  for (const page of crawled) {
    for (const link of page.internalLinksOut) {
      if (!reverseLinks.has(link)) reverseLinks.set(link, []);
      reverseLinks.get(link)!.push(page.url);
    }
  }

  // Attach linkedFrom to each page (stored as JSON later)
  for (const page of crawled) {
    (page as any).linkedFrom = reverseLinks.get(page.url) ?? [];
  }

  return {
    pages: crawled,
    sitemapUrlCount: sitemapSet.size,
    orphanCount: orphanUrls.size,
  };
}
