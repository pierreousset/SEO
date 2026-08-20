import * as cheerio from "cheerio";
import { auditCopy, type AuditLang, type FindingVars } from "@/lib/audit/messages";

export type Severity = "high" | "medium" | "low" | "info";

export type Finding = {
  url: string;
  category: string;
  checkKey: string;
  severity: Severity;
  message: string;
  detail?: string;
  fix?: string;
};

/** Extracted meta data for a single page (complete, not just issues). */
export type PageMeta = {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  wordCount: number;
  indexable: boolean;
};

/** Extract all meta data from a page — stored for every page regardless of issues. */
export function extractPageMeta(url: string, html: string): PageMeta {
  const $ = cheerio.load(html);
  const title = $("head > title").first().text().trim() || null;
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1s = $("h1").toArray();
  const h1 = h1s.length > 0 ? $(h1s[0]).text().trim() || null : null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim() || null;
  const ogImg = $('meta[property="og:image"]').attr("content")?.trim() || null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  const indexable = !robotsMeta.includes("noindex");

  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;

  return {
    url,
    title,
    titleLength: title?.length ?? 0,
    metaDescription: metaDesc,
    metaDescriptionLength: metaDesc?.length ?? 0,
    h1,
    canonical,
    ogTitle,
    ogDescription: ogDesc,
    ogImage: ogImg,
    wordCount,
    indexable,
  };
}

/**
 * Run all per-page checks against a fetched HTML document.
 * Returns a list of findings (only failures + warnings — passing checks are silent).
 */
export function runPageChecks(opts: {
  url: string;
  html: string;
  status: number;
  responseMs: number;
  bytes: number;
  trackedKeywords: string[];
  lang?: AuditLang;
}): Finding[] {
  const findings: Finding[] = [];
  const $ = cheerio.load(opts.html);
  const lang: AuditLang = opts.lang ?? "fr";
  const add = (
    checkKey: string,
    fields: {
      category: string;
      severity: Severity;
      vars?: FindingVars;
      detail?: string;
    },
  ) => {
    const copy = auditCopy(checkKey, lang, fields.vars);
    findings.push({
      url: opts.url,
      category: fields.category,
      checkKey,
      severity: fields.severity,
      message: copy?.message ?? checkKey,
      detail: copy?.detail ?? fields.detail,
      fix: copy?.fix,
    });
  };

  // ---- Title ----
  const title = $("head > title").first().text().trim();
  if (!title) {
    add("title_missing", { category: "title", severity: "high" });
  } else if (title.length < 30) {
    add("title_short", {
      category: "title",
      severity: "medium",
      vars: { n: title.length },
      detail: `"${title}"`,
    });
  } else if (title.length > 70) {
    add("title_long", {
      category: "title",
      severity: "medium",
      vars: { n: title.length },
      detail: `"${title}"`,
    });
  }

  // Title contains a tracked keyword (any one)?
  if (title && opts.trackedKeywords.length > 0) {
    const lc = title.toLowerCase();
    const hit = opts.trackedKeywords.find((k) => lc.includes(k.toLowerCase()));
    if (!hit) {
      const missing = opts.trackedKeywords.filter((k) => !lc.includes(k.toLowerCase()));
      add("title_no_keyword", {
        category: "title",
        severity: "medium",
        detail: `"${title}"`,
        vars: { missing: missing.slice(0, 8).join(", ") },
      });
    }
  }

  // ---- Meta description ----
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDesc) {
    add("meta_missing", { category: "meta", severity: "high" });
  } else if (metaDesc.length < 80) {
    add("meta_short", {
      category: "meta",
      severity: "low",
      vars: { n: metaDesc.length },
      detail: `"${metaDesc}"`,
    });
  } else if (metaDesc.length > 170) {
    add("meta_long", {
      category: "meta",
      severity: "low",
      vars: { n: metaDesc.length },
      detail: `"${metaDesc}"`,
    });
  }

  // ---- H1 ----
  const h1s = $("h1").toArray();
  if (h1s.length === 0) {
    add("h1_missing", { category: "h1", severity: "high" });
  } else if (h1s.length > 1) {
    add("h1_multiple", { category: "h1", severity: "medium", vars: { n: h1s.length } });
  } else {
    const h1Text = $(h1s[0]).text().trim();
    if (!h1Text) {
      add("h1_empty", { category: "h1", severity: "high" });
    }
  }

  // ---- Canonical ----
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  if (!canonical) {
    add("canonical_missing", { category: "canonical", severity: "medium" });
  }

  // ---- Robots meta ----
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  if (robotsMeta.includes("noindex")) {
    add("robots_noindex", { category: "tech", severity: "high", detail: robotsMeta });
  }

  // ---- Open Graph ----
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImg = $('meta[property="og:image"]').attr("content");
  if (!ogTitle || !ogDesc || !ogImg) {
    add("og_incomplete", {
      category: "og",
      severity: "low",
      vars: {
        missing: [!ogTitle && "og:title", !ogDesc && "og:description", !ogImg && "og:image"]
          .filter(Boolean)
          .join(", "),
      },
    });
  }

  // ---- Schema.org markup (JSON-LD, microdata, or RDFa) ----
  // Note: we only see the SSR HTML. Sites that inject schema via client-side JS
  // or tag managers will look "missing" here even though Google sees it after rendering.
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasMicrodata = $("[itemscope][itemtype]").length > 0;
  const hasRdfa = $("[typeof], [vocab]").length > 0;
  if (!hasJsonLd && !hasMicrodata && !hasRdfa) {
    add("schema_missing", { category: "schema", severity: "info" });
  }

  // ---- Image alt text ----
  const imgs = $("img").toArray();
  if (imgs.length > 0) {
    const noAlt = imgs.filter((el) => {
      const alt = $(el).attr("alt");
      return alt == null || alt.trim() === "";
    }).length;
    const ratio = noAlt / imgs.length;
    if (ratio > 0.3 && noAlt >= 3) {
      add("alt_missing", {
        category: "alt",
        severity: "medium",
        vars: { n: noAlt, n2: imgs.length, pct: Math.round(ratio * 100) },
      });
    }
  }

  // ---- Internal links ----
  const allLinks = $("a[href]").toArray();
  let host = "";
  try {
    host = new URL(opts.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {}
  const internal = allLinks.filter((el) => {
    const href = $(el).attr("href");
    if (!href) return false;
    if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) return true;
    try {
      const h = new URL(href, opts.url).hostname.replace(/^www\./, "").toLowerCase();
      return h === host;
    } catch {
      return false;
    }
  }).length;
  if (internal < 3) {
    add("low_internal_links", {
      category: "links",
      severity: "medium",
      vars: { n: internal },
    });
  }

  // ---- Word count ----
  // Strip script/style and count words on visible text
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  if (wordCount < 300) {
    add("thin_content", {
      category: "content",
      severity: wordCount < 100 ? "high" : "medium",
      vars: { n: wordCount },
    });
  }

  // ---- Tech: response code / size / time ----
  if (opts.status >= 400) {
    add("bad_status", { category: "tech", severity: "high", vars: { status: opts.status } });
  }
  if (opts.bytes > 1_500_000) {
    add("heavy_html", {
      category: "tech",
      severity: "low",
      vars: { kb: (opts.bytes / 1024).toFixed(0) },
    });
  }
  if (opts.responseMs > 1500) {
    add("slow_response", {
      category: "tech",
      severity: "medium",
      vars: { ms: opts.responseMs },
    });
  }

  return findings;
}

/**
 * Site-wide checks: robots.txt, sitemap.xml, HTTPS.
 * Takes the homepage URL.
 */
export async function runSiteWideChecks(
  homepageUrl: string,
  lang: AuditLang = "fr",
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const add = (url: string, checkKey: string, severity: Severity) => {
    const copy = auditCopy(checkKey, lang);
    findings.push({
      url,
      category: "site",
      checkKey,
      severity,
      message: copy?.message ?? checkKey,
      fix: copy?.fix,
    });
  };
  let origin = "";
  try {
    const u = new URL(homepageUrl);
    origin = `${u.protocol}//${u.host}`;
    if (u.protocol !== "https:") {
      add(origin, "no_https", "high");
    }
  } catch {
    return findings;
  }

  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      add(`${origin}/robots.txt`, "robots_missing", "medium");
    } else {
      const text = await res.text();
      if (!/sitemap:/i.test(text)) {
        const copy = auditCopy("robots_no_sitemap", lang);
        findings.push({
          url: `${origin}/robots.txt`,
          category: "site",
          checkKey: "robots_no_sitemap",
          severity: "low",
          message: copy?.message ?? "robots_no_sitemap",
          fix: copy?.fix,
        });
      }
    }
  } catch {
    add(`${origin}/robots.txt`, "robots_unreachable", "medium");
  }

  try {
    const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      add(`${origin}/sitemap.xml`, "sitemap_missing", "medium");
    }
  } catch {
    add(`${origin}/sitemap.xml`, "sitemap_unreachable", "low");
  }

  return findings;
}
