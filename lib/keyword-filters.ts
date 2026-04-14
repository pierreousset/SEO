/**
 * Server-side keyword filtering. Used by /dashboard/keywords to filter the
 * row list based on URL search params. Keep in sync with KeywordsFilterBar UI.
 *
 * NO "use client" — this is imported by both server components and the client
 * filter bar.
 */

export type KeywordFilters = {
  q: string;
  intents: string[];
  diagnostics: string[];
  position: string;
  movement: string;
  minImpressions: number;
  comp: string;
};

export function parseFiltersFromSearchParams(
  sp: URLSearchParams | { get(k: string): string | null },
): KeywordFilters {
  return {
    q: sp.get("q") ?? "",
    intents: (sp.get("intent") ?? "").split(",").filter(Boolean),
    diagnostics: (sp.get("diag") ?? "").split(",").filter(Boolean),
    position: sp.get("pos") ?? "all",
    movement: sp.get("mov") ?? "all",
    minImpressions: Number(sp.get("imp") ?? "0") || 0,
    comp: sp.get("comp") ?? "all",
  };
}

export type FilterableRow = {
  keyword: string;
  intentStage: number | null;
  diagnostic: string;
  position: number | null;
  delta7d: number | null;
  bestCompPosition: number | null;
  // Optional GSC summary; pass total impressions over the brief window
  gscImpressions?: number | null;
};

export type AppliedFilters = KeywordFilters;

export function applyFilters<T extends FilterableRow>(rows: T[], f: KeywordFilters): T[] {
  return rows.filter((r) => {
    // Text search
    if (f.q && !r.keyword.toLowerCase().includes(f.q.toLowerCase())) return false;

    // Intent stages — "0" means unclassified (intentStage is null)
    if (f.intents.length > 0) {
      const stageStr = r.intentStage == null ? "0" : String(r.intentStage);
      if (!f.intents.includes(stageStr)) return false;
    }

    // Diagnostic tags
    if (f.diagnostics.length > 0 && !f.diagnostics.includes(r.diagnostic)) {
      return false;
    }

    // Position bucket
    if (f.position !== "all") {
      const p = r.position;
      if (f.position === "unranked") {
        if (p != null) return false;
      } else {
        const [min, max] = f.position.split("-").map(Number);
        if (p == null || p < min || p > max) return false;
      }
    }

    // 7-day movement
    if (f.movement !== "all") {
      const d = r.delta7d;
      if (f.movement === "up" && (d == null || d <= 0)) return false;
      if (f.movement === "down" && (d == null || d >= 0)) return false;
      if (f.movement === "stable" && d != null && Math.abs(d) > 1) return false;
    }

    // Min impressions (requires GSC data)
    if (f.minImpressions > 0) {
      if ((r.gscImpressions ?? 0) < f.minImpressions) return false;
    }

    // Competitor positioning
    if (f.comp !== "all") {
      const myPos = r.position;
      const compPos = r.bestCompPosition;
      if (compPos == null) return false; // no competitor data → exclude
      if (f.comp === "behind") {
        // Competitor outranks me (lower number = better)
        if (myPos == null || compPos >= myPos) return false;
      }
      if (f.comp === "ahead") {
        if (myPos == null || compPos <= myPos) return false;
      }
    }

    return true;
  });
}
