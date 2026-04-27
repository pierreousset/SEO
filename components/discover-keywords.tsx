"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { Loader2, Plus, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoverGscQueries, bulkAddKeywords, type DiscoveryQuery } from "@/lib/actions/discover";
import { toast } from "sonner";

const PRESETS = [
  { id: "high_imp_no_clicks", label: "High impressions, 0 clicks", desc: "Page 2-3 gold" },
  { id: "longtail_clicks", label: "Long-tail with clicks", desc: "Sporadic but converting" },
  { id: "recent", label: "Newly appeared", desc: "Started in last 14d" },
  { id: "near_page_1", label: "Near page 1", desc: "Avg position 5-15" },
  { id: "all", label: "All opportunities", desc: "Sorted by score" },
];

function applyPreset(rows: DiscoveryQuery[], preset: string): DiscoveryQuery[] {
  const cutoff14d = new Date();
  cutoff14d.setUTCDate(cutoff14d.getUTCDate() - 14);
  const cutoffStr = cutoff14d.toISOString().slice(0, 10);

  switch (preset) {
    case "high_imp_no_clicks":
      return rows.filter((r) => r.impressions >= 50 && r.clicks === 0);
    case "longtail_clicks":
      return rows.filter((r) => r.clicks >= 1 && r.clicks <= 10 && r.query.split(" ").length >= 3);
    case "recent":
      return rows.filter((r) => r.firstSeenDate >= cutoffStr);
    case "near_page_1":
      return rows.filter((r) => r.avgPosition >= 5 && r.avgPosition <= 15);
    default:
      return rows;
  }
}

export function DiscoverKeywords() {
  // Don't auto-load on mount — the GSC pull is a real network call (up to 30s).
  // Require explicit user click so we don't hammer GSC every time the tab is visited.
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DiscoveryQuery[]>([]);
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState("high_imp_no_clicks");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(90);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await discoverGscQueries({ days, minImpressions: 5 });
      if (res.error) setError(res.error);
      setData(res.queries);
      setHasLoaded(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch GSC discovery");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let rows = applyPreset(data, preset);
    if (search) {
      const lc = search.toLowerCase();
      rows = rows.filter((r) => r.query.toLowerCase().includes(lc));
    }
    return rows;
  }, [data, preset, search]);

  function toggle(q: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((r) => r.query)));
  }

  function bulkAdd() {
    if (selected.size === 0) return;
    const queries = Array.from(selected);
    start(async () => {
      try {
        const res = await bulkAddKeywords(queries);
        toast.success(`Added ${res.added} keyword(s)${res.skipped ? `, ${res.skipped} skipped (duplicates)` : ""}.`);
        setSelected(new Set());
        load();
      } catch (e: any) {
        toast.error(e?.message ?? "Bulk add failed");
      }
    });
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-secondary p-8 text-sm text-muted-foreground">
        <p className="mb-2">Couldn't fetch GSC: {error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  // First visit — show explicit CTA instead of auto-fetching
  if (!hasLoaded && !loading) {
    return (
      <div className="rounded-2xl bg-secondary p-8 text-sm">
        <p className="text-muted-foreground mb-4">
          Pulls the last 90 days of Google Search Console queries (live API call, takes
          10-20s). Shows queries you rank for but don't track yet, sorted by opportunity.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-full bg-background border border-input px-3 text-xs"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
          <Button onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Pull GSC queries
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preset bar */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            title={p.desc}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              preset === p.id
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-full bg-background border border-input px-3 text-xs"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Search + bulk action */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by query…"
          className="h-9 rounded-full max-w-xs"
        />
        <div className="text-xs text-muted-foreground font-mono tabular">
          {filtered.length} shown {selected.size > 0 && `· ${selected.size} selected`}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select all visible
          </Button>
          <Button onClick={bulkAdd} disabled={selected.size === 0 || pending} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {pending ? "Adding…" : `Add ${selected.size || ""} to tracking`}
          </Button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="rounded-2xl bg-secondary p-12 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
          Pulling 90 days of GSC data… this can take 10-20s
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-secondary p-12 text-center text-muted-foreground">
          No queries match this filter.
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="text-left px-3 py-2">Query</th>
                <th className="text-right px-3 py-2">Impressions</th>
                <th className="text-right px-3 py-2">Clicks</th>
                <th className="text-right px-3 py-2">CTR</th>
                <th className="text-right px-3 py-2">Avg pos</th>
                <th className="text-right px-3 py-2">Days seen</th>
                <th className="text-right px-3 py-2">First seen</th>
                <th className="text-right px-3 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((r) => {
                const isSel = selected.has(r.query);
                return (
                  <tr
                    key={r.query}
                    onClick={() => toggle(r.query)}
                    className={`border-t border-border hover:bg-muted/30 cursor-pointer ${
                      isSel ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(r.query)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-foreground"
                      />
                    </td>
                    <td className="px-3 py-2 truncate max-w-[300px]" title={r.query}>
                      {r.query}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {r.impressions.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {r.clicks > 0 ? (
                        r.clicks
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular text-xs">
                      {(r.ctr * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {r.avgPosition > 0 ? r.avgPosition.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular text-xs text-muted-foreground">
                      {r.daysSeen}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular text-xs text-muted-foreground">
                      {r.firstSeenDate}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular font-semibold">
                      {r.opportunityScore.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border bg-muted/20">
              Showing top 100 of {filtered.length}. Use search or different preset to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
