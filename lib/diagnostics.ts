/**
 * Per-keyword diagnostic tag — explains WHY a keyword is performing the way it is.
 *
 * Categories (position-based, no GSC required):
 *   - momentum     gained > 5 positions in last 7 days (rising star, double-down)
 *   - gap_zone     current position 5-20 (page 2 / page 1 within reach in 30-60d)
 *   - lost_ground  dropped > 5 positions in last 7 days (urgent, investigate)
 *   - stale        position barely moved (±1) for 14+ days, ranked > 10 (needs intervention)
 *   - top          current position 1-4 (defended territory, monitor)
 *   - unranked     never appeared in top 100 (long-term play OR pruned candidate)
 *
 * GSC-dependent (NOT YET IMPLEMENTED — needs ongoing GSC clicks/impressions fetch):
 *   - weak_ctr      top 10 but CTR < 3% (title/meta description rewrite)
 *   - low_authority high impressions but rank > 20 (needs internal links)
 */

export type Diagnostic =
  | "momentum"
  | "gap_zone"
  | "lost_ground"
  | "stale"
  | "top"
  | "unranked"
  | "weak_ctr"
  | "low_authority"
  | "no_data";

export type DiagnosticInfo = {
  tag: Diagnostic;
  label: string;
  /** One-line recommendation for the user. */
  hint: string;
  /** Tone for the badge color. */
  tone: "good" | "warn" | "bad" | "neutral";
};

const META: Record<Diagnostic, Omit<DiagnosticInfo, "tag">> = {
  momentum: {
    label: "momentum",
    hint: "Gaining ground — double down with internal links + fresh content.",
    tone: "good",
  },
  gap_zone: {
    label: "gap zone",
    hint: "Page 2. One title/meta polish + 1 backlink can land you on page 1 in 30-60d.",
    tone: "good",
  },
  lost_ground: {
    label: "lost ground",
    hint: "Investigate this week. Algo update, competitor move, or page change?",
    tone: "bad",
  },
  stale: {
    label: "stale",
    hint: "Hasn't moved in 2+ weeks. Refresh content, add internal links, or prune.",
    tone: "warn",
  },
  top: {
    label: "top",
    hint: "Defended territory. Monitor weekly for drops.",
    tone: "neutral",
  },
  unranked: {
    label: "unranked",
    hint: "No top 100 visibility. Long-term play — needs net-new content.",
    tone: "neutral",
  },
  weak_ctr: {
    label: "weak ctr",
    hint: "Top 10 but CTR below 3%. Title or meta description not pulling clicks. Rewrite both.",
    tone: "warn",
  },
  low_authority: {
    label: "needs links",
    hint: "High impressions but ranking deep. Page needs internal links + topical authority.",
    tone: "warn",
  },
  no_data: {
    label: "—",
    hint: "Not enough fetches yet to diagnose.",
    tone: "neutral",
  },
};

export function diagnosticInfo(tag: Diagnostic): DiagnosticInfo {
  return { tag, ...META[tag] };
}

/**
 * GSC stats summary for a keyword over the period analyzed.
 * Used to enrich diagnostics with click/impression/CTR data when available.
 */
export type GscSummary = {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number; // 0-1
  avgPosition: number | null;
};

/**
 * Compute a single diagnostic from a keyword's recent position history.
 * Optional GSC summary enables richer diagnostics (weak_ctr, low_authority).
 * History expected sorted oldest → newest, position null = not in top 100.
 */
export function computeDiagnostic(
  history: Array<{ date: string; position: number | null }>,
  gsc?: GscSummary | null,
): Diagnostic {
  if (history.length === 0) return "no_data";
  const latest = history.at(-1)!.position;

  // No top 100 visibility at all → unranked
  const everRanked = history.some((h) => h.position != null);
  if (!everRanked) return "unranked";

  if (latest == null) return "lost_ground"; // fell out of top 100 recently

  // Compute 7-day delta if we have enough history
  const sevenDaysAgo = history.at(-8) ?? history.at(0); // fallback to oldest if < 8 days
  const past = sevenDaysAgo?.position;
  if (past != null) {
    const delta = past - latest; // positive = improved
    if (delta >= 5) return "momentum";
    if (delta <= -5) return "lost_ground";
  }

  // GSC-enriched diagnostics — only fire when we have meaningful GSC data
  if (gsc && gsc.totalImpressions >= 50) {
    // weak_ctr: ranks well but CTR is below 3% (title/meta problem)
    if (latest <= 10 && gsc.avgCtr < 0.03 && gsc.totalImpressions >= 100) {
      return "weak_ctr";
    }
    // low_authority: lots of impressions but rank > 20 (needs internal links)
    if (latest > 20 && gsc.totalImpressions >= 500) {
      return "low_authority";
    }
  }

  // Top 4 = defended territory
  if (latest <= 4) return "top";

  // Page 2 zone
  if (latest >= 5 && latest <= 20) return "gap_zone";

  // Stale: ranked > 20 and hasn't budged in last 14 entries
  const recent14 = history.slice(-14);
  if (recent14.length >= 14 && latest > 20) {
    const positions = recent14.map((h) => h.position ?? 999);
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    if (max - min <= 1) return "stale";
  }

  // Default for rank 21-100 with movement
  return "stale";
}
