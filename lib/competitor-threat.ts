/**
 * Classify each competitor URL into HIGH / MEDIUM / LOW threat tier.
 *
 * Inspired by mikefutia/seo-agent's competitor_intel.py logic:
 *   HIGH   = brand/authority domain — entrenched, months to displace
 *   MEDIUM = active SEO signals (year-in-URL, /vs/, /best/, /guide/) — beatable in 30-60d
 *   LOW    = thin or coincidental ranking — defeatable with one focused page
 *
 * Used by the brief AI to recommend "battles to fight" (LOW first) vs
 * "battles to skip" (HIGH = find a different angle instead).
 */

export type ThreatTier = "HIGH" | "MEDIUM" | "LOW";

export type ThreatInfo = {
  tier: ThreatTier;
  reason: string;
};

// Domains with established SEO authority. Add more as needed.
// Ideally fed from a real DR API (Moz, Ahrefs) — for now, hand-curated.
const HIGH_AUTHORITY_DOMAINS = new Set([
  "wikipedia.org",
  "fr.wikipedia.org",
  "en.wikipedia.org",
  "ahrefs.com",
  "semrush.com",
  "moz.com",
  "hubspot.com",
  "neilpatel.com",
  "backlinko.com",
  "searchengineland.com",
  "searchenginejournal.com",
  "google.com",
  "youtube.com",
  "linkedin.com",
  "reddit.com",
  "quora.com",
  "medium.com",
  "amazon.com",
  "amazon.fr",
  "shopify.com",
  "wix.com",
  "squarespace.com",
  "wordpress.com",
  "stackoverflow.com",
  "github.com",
  // Big French players — extend per industry
  "lemonde.fr",
  "lefigaro.fr",
  "lesechos.fr",
  "leparisien.fr",
  "ouest-france.fr",
]);

const MED_URL_SIGNALS = [
  /\b20(2[5-9]|3[0-9])\b/, // year 2025-2039 in URL
  /\/vs\b/i,
  /\bversus\b/i,
  /\/best[-/]/i,
  /\bbest-/i,
  /\bmeilleur/i,
  /\bcomparison/i,
  /\bcompar/i,
  /\/guide[-/]/i,
  /\bultimate-guide/i,
  /\bcomplete-guide/i,
  /\btop-?\d+/i,
];

function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

function isAuthorityDomain(host: string): boolean {
  if (HIGH_AUTHORITY_DOMAINS.has(host)) return true;
  // Also match subdomains of known authority domains
  for (const d of HIGH_AUTHORITY_DOMAINS) {
    if (host.endsWith("." + d)) return true;
  }
  return false;
}

function brandMatch(host: string, brandName: string | null | undefined): boolean {
  if (!brandName) return false;
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length < 4) return false;
  return host.replace(/[^a-z0-9]/g, "").includes(slug);
}

/**
 * Classify a competitor at the URL level (works on any ranking URL we observe).
 * For domain-only classification (e.g. business profile competitor list), pass the URL as `https://domain/`.
 */
export function classifyCompetitorUrl(
  url: string,
  brandHint?: string | null,
): ThreatInfo {
  const host = urlHost(url);

  if (isAuthorityDomain(host)) {
    return {
      tier: "HIGH",
      reason: `Authority domain (${host}) — entrenched, months to displace. Find a different angle.`,
    };
  }

  if (brandMatch(host, brandHint)) {
    return {
      tier: "HIGH",
      reason: `Brand-match domain — owners are defending their own brand.`,
    };
  }

  for (const re of MED_URL_SIGNALS) {
    if (re.test(url)) {
      return {
        tier: "MEDIUM",
        reason: `Active SEO page (URL signals: comparison/year/guide). Beatable in 30-60d with a sharper angle.`,
      };
    }
  }

  return {
    tier: "LOW",
    reason: `No strong authority or SEO signals — likely beatable with one focused page.`,
  };
}

/** Classify by domain only (no URL path). Used in the business profile listing. */
export function classifyCompetitorDomain(domain: string, brandHint?: string | null): ThreatInfo {
  return classifyCompetitorUrl(`https://${domain}/`, brandHint);
}
