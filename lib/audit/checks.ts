import * as cheerio from "cheerio";

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
}): Finding[] {
  const findings: Finding[] = [];
  const $ = cheerio.load(opts.html);

  // ---- Title ----
  const title = $("head > title").first().text().trim();
  if (!title) {
    findings.push({
      url: opts.url,
      category: "title",
      checkKey: "title_missing",
      severity: "high",
      message: "Missing <title> tag",
      fix: "Add a unique title tag describing the page in 30-60 characters.",
    });
  } else if (title.length < 30) {
    findings.push({
      url: opts.url,
      category: "title",
      checkKey: "title_short",
      severity: "medium",
      message: `Title too short (${title.length} chars)`,
      detail: `"${title}"`,
      fix: "Expand to 30-60 chars with the primary keyword and a benefit.",
    });
  } else if (title.length > 70) {
    findings.push({
      url: opts.url,
      category: "title",
      checkKey: "title_long",
      severity: "medium",
      message: `Title too long (${title.length} chars) — Google truncates`,
      detail: `"${title}"`,
      fix: "Trim to 50-60 chars. Front-load the keyword.",
    });
  }

  // Title contains a tracked keyword (any one)?
  if (title && opts.trackedKeywords.length > 0) {
    const lc = title.toLowerCase();
    const hit = opts.trackedKeywords.find((k) => lc.includes(k.toLowerCase()));
    if (!hit) {
      findings.push({
        url: opts.url,
        category: "title",
        checkKey: "title_no_keyword",
        severity: "medium",
        message: "Title contains none of your tracked keywords",
        detail: `"${title}"`,
        fix: "Include at least one tracked keyword (or a close variant) in the title.",
      });
    }
  }

  // ---- Meta description ----
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDesc) {
    findings.push({
      url: opts.url,
      category: "meta",
      checkKey: "meta_missing",
      severity: "high",
      message: "Missing meta description",
      fix: "Add a 120-160 character meta description with a clear value prop and CTA.",
    });
  } else if (metaDesc.length < 80) {
    findings.push({
      url: opts.url,
      category: "meta",
      checkKey: "meta_short",
      severity: "low",
      message: `Meta description short (${metaDesc.length} chars)`,
      detail: `"${metaDesc}"`,
      fix: "Expand to 120-160 chars with keywords + a clear benefit.",
    });
  } else if (metaDesc.length > 170) {
    findings.push({
      url: opts.url,
      category: "meta",
      checkKey: "meta_long",
      severity: "low",
      message: `Meta description long (${metaDesc.length} chars) — Google truncates`,
      detail: `"${metaDesc}"`,
      fix: "Trim to 150-160 chars.",
    });
  }

  // ---- H1 ----
  const h1s = $("h1").toArray();
  if (h1s.length === 0) {
    findings.push({
      url: opts.url,
      category: "h1",
      checkKey: "h1_missing",
      severity: "high",
      message: "Missing <h1>",
      fix: "Add exactly one <h1> at the top of the page describing what it's about.",
    });
  } else if (h1s.length > 1) {
    findings.push({
      url: opts.url,
      category: "h1",
      checkKey: "h1_multiple",
      severity: "medium",
      message: `${h1s.length} <h1> tags — should be exactly 1`,
      fix: "Convert extra h1s to h2/h3. Keep one h1 only.",
    });
  } else {
    const h1Text = $(h1s[0]).text().trim();
    if (!h1Text) {
      findings.push({
        url: opts.url,
        category: "h1",
        checkKey: "h1_empty",
        severity: "high",
        message: "<h1> is empty",
        fix: "Put descriptive content in the h1.",
      });
    }
  }

  // ---- Canonical ----
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  if (!canonical) {
    findings.push({
      url: opts.url,
      category: "canonical",
      checkKey: "canonical_missing",
      severity: "medium",
      message: "Missing canonical link",
      fix: 'Add <link rel="canonical" href="..."> pointing to the canonical URL.',
    });
  }

  // ---- Robots meta ----
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  if (robotsMeta.includes("noindex")) {
    findings.push({
      url: opts.url,
      category: "tech",
      checkKey: "robots_noindex",
      severity: "high",
      message: "Page is set to noindex",
      detail: robotsMeta,
      fix: "Remove the noindex directive if you want this page in Google.",
    });
  }

  // ---- Open Graph ----
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImg = $('meta[property="og:image"]').attr("content");
  if (!ogTitle || !ogDesc || !ogImg) {
    findings.push({
      url: opts.url,
      category: "og",
      checkKey: "og_incomplete",
      severity: "low",
      message: "Open Graph tags incomplete",
      detail: `Missing: ${[
        !ogTitle && "og:title",
        !ogDesc && "og:description",
        !ogImg && "og:image",
      ]
        .filter(Boolean)
        .join(", ")}`,
      fix: "Add all three OG tags so social shares render with a preview card.",
    });
  }

  // ---- Schema.org markup (JSON-LD, microdata, or RDFa) ----
  // Note: we only see the SSR HTML. Sites that inject schema via client-side JS
  // or tag managers will look "missing" here even though Google sees it after rendering.
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasMicrodata = $("[itemscope][itemtype]").length > 0;
  const hasRdfa = $("[typeof], [vocab]").length > 0;
  if (!hasJsonLd && !hasMicrodata && !hasRdfa) {
    findings.push({
      url: opts.url,
      category: "schema",
      checkKey: "schema_missing",
      severity: "info",
      message: "No schema.org markup detected in initial HTML",
      detail:
        "Checked JSON-LD, microdata, and RDFa in the SSR response. " +
        "If you inject schema via client-side JavaScript or a tag manager, " +
        "our crawler can't see it — but Google can.",
      fix: "Add LocalBusiness/Organization/Article/Product/BreadcrumbList JSON-LD server-side. " +
        "Verify with Google Rich Results Test (search.google.com/test/rich-results).",
    });
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
      findings.push({
        url: opts.url,
        category: "alt",
        checkKey: "alt_missing",
        severity: "medium",
        message: `${noAlt}/${imgs.length} images missing alt text (${Math.round(ratio * 100)}%)`,
        fix: "Add descriptive alt to every meaningful image. Decorative images: alt=\"\".",
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
    findings.push({
      url: opts.url,
      category: "links",
      checkKey: "low_internal_links",
      severity: "medium",
      message: `Only ${internal} internal links on this page`,
      fix: "Add 5-15 contextual internal links to related pages. Helps crawl + ranking.",
    });
  }

  // ---- Word count ----
  // Strip script/style and count words on visible text
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  if (wordCount < 300) {
    findings.push({
      url: opts.url,
      category: "content",
      checkKey: "thin_content",
      severity: wordCount < 100 ? "high" : "medium",
      message: `Thin content — only ${wordCount} words`,
      fix: "Add at least 300 words of substantive content. 600-1200 is the sweet spot.",
    });
  }

  // ---- Tech: response code / size / time ----
  if (opts.status >= 400) {
    findings.push({
      url: opts.url,
      category: "tech",
      checkKey: "bad_status",
      severity: "high",
      message: `Page returns HTTP ${opts.status}`,
      fix: "Fix the underlying error or redirect to a working page.",
    });
  }
  if (opts.bytes > 1_500_000) {
    findings.push({
      url: opts.url,
      category: "tech",
      checkKey: "heavy_html",
      severity: "low",
      message: `HTML is ${(opts.bytes / 1024).toFixed(0)} KB — heavy`,
      fix: "Reduce inline scripts/styles, defer non-critical JS, lazy-load images.",
    });
  }
  if (opts.responseMs > 1500) {
    findings.push({
      url: opts.url,
      category: "tech",
      checkKey: "slow_response",
      severity: "medium",
      message: `Server response slow (${opts.responseMs}ms)`,
      fix: "Aim for <500ms TTFB. Check origin server, cache, and middleware.",
    });
  }

  return findings;
}

/**
 * Site-wide checks: robots.txt, sitemap.xml, HTTPS.
 * Takes the homepage URL.
 */
export async function runSiteWideChecks(homepageUrl: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let origin = "";
  try {
    const u = new URL(homepageUrl);
    origin = `${u.protocol}//${u.host}`;
    if (u.protocol !== "https:") {
      findings.push({
        url: origin,
        category: "site",
        checkKey: "no_https",
        severity: "high",
        message: "Site is not served over HTTPS",
        fix: "Move to HTTPS — Google ranks HTTPS pages higher and modern browsers warn on HTTP.",
      });
    }
  } catch {
    return findings;
  }

  // robots.txt
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      findings.push({
        url: `${origin}/robots.txt`,
        category: "site",
        checkKey: "robots_missing",
        severity: "medium",
        message: "robots.txt not found",
        fix: "Add a robots.txt at site root listing your sitemap and any disallowed paths.",
      });
    } else {
      const text = await res.text();
      if (!/sitemap:/i.test(text)) {
        findings.push({
          url: `${origin}/robots.txt`,
          category: "site",
          checkKey: "robots_no_sitemap",
          severity: "low",
          message: "robots.txt does not declare a sitemap",
          fix: `Add "Sitemap: ${origin}/sitemap.xml" to robots.txt.`,
        });
      }
    }
  } catch {
    findings.push({
      url: `${origin}/robots.txt`,
      category: "site",
      checkKey: "robots_unreachable",
      severity: "medium",
      message: "robots.txt unreachable",
      fix: "Check that /robots.txt returns a 200 response.",
    });
  }

  // sitemap.xml
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      findings.push({
        url: `${origin}/sitemap.xml`,
        category: "site",
        checkKey: "sitemap_missing",
        severity: "medium",
        message: "sitemap.xml not found",
        fix: "Generate a sitemap.xml listing all indexable URLs and submit to GSC.",
      });
    }
  } catch {
    findings.push({
      url: `${origin}/sitemap.xml`,
      category: "site",
      checkKey: "sitemap_unreachable",
      severity: "low",
      message: "sitemap.xml unreachable",
      fix: "Make /sitemap.xml return a 200 response.",
    });
  }

  return findings;
}
