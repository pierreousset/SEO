"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  discoverCompetitorKeywords,
  bulkAddKeywords,
  type CompetitorKeyword,
} from "@/lib/actions/discover";
import { toast } from "sonner";

export function DiscoverCompetitors() {
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompetitorKeyword[]>([]);
  const [competitorsScanned, setCompetitorsScanned] = useState(0);
  const [search, setSearch] = useState("");
  const [minVolume, setMinVolume] = useState(50);
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await discoverCompetitorKeywords({
        minSearchVolume: minVolume,
        maxPosition: 30,
      });
      if (res.error) setError(res.error);
      setData(res.keywords);
      setCompetitorsScanned(res.competitorsScanned);
    } catch (e: any) {
      setError(e?.message ?? "Competitor fetch failed");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const lc = search.toLowerCase();
      rows = rows.filter((r) => r.keyword.toLowerCase().includes(lc));
    }
    if (onlyMulti) {
      rows = rows.filter((r) => r.alsoRankedBy.length >= 2);
    }
    return rows;
  }, [data, search, onlyMulti]);

  function toggle(q: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  function bulkAdd() {
    if (selected.size === 0) return;
    start(async () => {
      try {
        const res = await bulkAddKeywords(Array.from(selected));
        toast.success(`Added ${res.added} keyword(s)${res.skipped ? ` · ${res.skipped} skipped` : ""}.`);
        setSelected(new Set());
      } catch (e: any) {
        toast.error(e?.message ?? "Bulk add failed");
      }
    });
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-secondary p-8 text-sm text-muted-foreground space-y-3">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <div className="rounded-2xl bg-secondary p-8 text-sm">
        <p className="text-muted-foreground mb-4">
          Pulls keywords your declared competitors rank for in the top 30, filtered to those
          you don't already track. Uses DataForSEO Labs — costs ~$0.30 per sync for 3 competitors.
        </p>
        <Button onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Pull competitor keywords · 20 credits
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by keyword…"
          className="h-9 rounded-full max-w-xs"
        />
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyMulti}
            onChange={(e) => setOnlyMulti(e.target.checked)}
            className="accent-foreground"
          />
          Only keywords 2+ competitors rank for
        </label>
        <select
          value={minVolume}
          onChange={(e) => {
            setMinVolume(Number(e.target.value));
          }}
          onBlur={() => load()}
          className="h-8 rounded-full bg-background border border-input px-3 text-xs"
        >
          <option value={10}>Min 10/mo</option>
          <option value={50}>Min 50/mo</option>
          <option value={200}>Min 200/mo</option>
          <option value={500}>Min 500/mo</option>
        </select>
        <div className="text-xs text-muted-foreground font-mono tabular ml-auto">
          {filtered.length} shown · {competitorsScanned} competitors scanned
          {selected.size > 0 && ` · ${selected.size} selected`}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Pulling…" : "Refresh · 20 credits"}
          </Button>
          <Button onClick={bulkAdd} disabled={selected.size === 0 || pending} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {pending ? "Adding…" : `Add ${selected.size || ""} to tracking`}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-secondary p-12 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
          Pulling competitor ranked keywords from DataForSEO…
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="text-left px-3 py-2">Keyword</th>
                <th className="text-right px-3 py-2">Volume</th>
                <th className="text-right px-3 py-2">Best comp pos</th>
                <th className="text-left px-3 py-2">Best comp</th>
                <th className="text-right px-3 py-2">Comps ranking</th>
                <th className="text-right px-3 py-2">Difficulty</th>
                <th className="text-right px-3 py-2">CPC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 150).map((r) => {
                const sel = selected.has(r.keyword);
                return (
                  <tr
                    key={r.keyword}
                    onClick={() => toggle(r.keyword)}
                    className={`border-t border-border hover:bg-muted/30 cursor-pointer ${
                      sel ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggle(r.keyword)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-foreground"
                      />
                    </td>
                    <td className="px-3 py-2 truncate max-w-[280px]" title={r.keyword}>
                      {r.keyword}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {r.searchVolume != null ? r.searchVolume.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {r.competitorPosition ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]">
                      {r.competitorDomain}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {r.alsoRankedBy.length}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular text-xs">
                      {r.keywordDifficulty != null ? r.keywordDifficulty : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular text-xs">
                      {r.cpc != null ? `€${r.cpc.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 150 && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border bg-muted/20">
              Showing top 150 of {filtered.length}. Narrow with filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
