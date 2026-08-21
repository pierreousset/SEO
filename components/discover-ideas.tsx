"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoverSeoKeywordIdeas, bulkAddKeywords } from "@/lib/actions/discover";
import type { SeoKeywordIdea } from "@/lib/seo/keyword-ideas";
import { locale } from "@/app/dashboard/keywords/discover/locale";
import type { Locale } from "@/lib/i18n";
import { toast } from "sonner";

function intentLabel(
  intent: string | null,
  dict: (typeof locale)["fr"]["ideas"]["intent"],
): string {
  if (!intent) return "—";
  if (intent in dict) return dict[intent as keyof typeof dict];
  return intent;
}

function kdClass(kd: number | null): string {
  if (kd == null) return "text-muted-foreground";
  if (kd <= 30) return "text-[var(--color-growth)]";
  if (kd <= 60) return "text-muted-foreground";
  return "text-down";
}

export function DiscoverIdeas({
  lng,
  initial,
}: {
  lng: Locale;
  initial?: {
    keywords: SeoKeywordIdea[];
    seeds: string[];
    fetchedAt: string | null;
  };
}) {
  const i = locale[lng].ideas;
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SeoKeywordIdea[]>(initial?.keywords ?? []);
  const [seeds, setSeeds] = useState<string[]>(initial?.seeds ?? []);
  const [fetchedAt, setFetchedAt] = useState<string | null>(initial?.fetchedAt ?? null);
  const [search, setSearch] = useState("");
  const [minVolume, setMinVolume] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasLoaded, setHasLoaded] = useState((initial?.keywords.length ?? 0) > 0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await discoverSeoKeywordIdeas({ minSearchVolume: 10 });
      if (res.error) setError(res.error);
      if (res.keywords.length > 0) {
        setData(res.keywords);
        setSeeds(res.seeds);
        setFetchedAt(res.fetchedAt);
      }
      setHasLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : i.failed);
    } finally {
      setLoading(false);
    }
  }

  const fetchedLabel = fetchedAt
    ? i.lastFetched(
        new Date(fetchedAt).toLocaleString(lng === "fr" ? "fr-FR" : "en-GB", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      )
    : null;

  const filtered = useMemo(() => {
    let rows = data.filter((r) => (r.searchVolume ?? 0) >= minVolume);
    if (search) {
      const lc = search.toLowerCase();
      rows = rows.filter((r) => r.keyword.toLowerCase().includes(lc));
    }
    return rows;
  }, [data, search, minVolume]);

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
        const res = await bulkAddKeywords(
          Array.from(selected).map((q) => {
            const row = data.find((d) => d.keyword === q);
            return {
              query: q,
              searchVolume: row?.searchVolume ?? null,
              keywordDifficulty: row?.keywordDifficulty ?? null,
              cpc: row?.cpc ?? null,
              searchIntent: row?.intent ?? null,
            };
          }),
        );
        toast.success(i.added(res.added, res.skipped));
        setSelected(new Set());
        setData((prev) => prev.filter((row) => !selected.has(row.keyword)));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : i.addFailed);
      }
    });
  }

  if (error && data.length === 0 && !loading) {
    return (
      <div className="sheet p-8 text-sm text-muted-foreground space-y-3">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          {i.pull}
        </Button>
      </div>
    );
  }

  if (!hasLoaded && !loading) {
    return (
      <div className="sheet p-8 text-sm">
        <p className="text-muted-foreground mb-4">{i.intro}</p>
        <Button onClick={load} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {i.pull}
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
          placeholder={i.filter}
          className="h-9 rounded-full max-w-xs"
        />
        <select
          value={minVolume}
          onChange={(e) => setMinVolume(Number(e.target.value))}
          className="h-8 rounded-full bg-background border border-input px-3 text-xs"
          aria-label={i.minVolume}
        >
          <option value={10}>10+/mo</option>
          <option value={20}>20+/mo</option>
          <option value={50}>50+/mo</option>
          <option value={200}>200+/mo</option>
        </select>
        <div className="text-xs text-muted-foreground tabular-nums ml-auto">
          {i.shown(filtered.length, seeds.length)}
          {selected.size > 0 && ` · ${i.selected(selected.size)}`}
          {fetchedLabel && ` · ${fetchedLabel}`}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? i.pulling : i.refresh}
          </Button>
          <Button onClick={bulkAdd} disabled={selected.size === 0 || pending} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {pending ? i.adding : i.add(selected.size)}
          </Button>
        </div>
      </div>

      {error && hasLoaded && (
        <p className="text-sm text-down">{error}</p>
      )}

      {loading ? (
        <div className="sheet p-12 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
          {i.pulling}
        </div>
      ) : (
        <div className="sheet overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="text-left px-3 py-2">{i.thKeyword}</th>
                <th className="text-right px-3 py-2">{i.thVolume}</th>
                <th className="text-right px-3 py-2">{i.thDifficulty}</th>
                <th className="text-left px-3 py-2">{i.thIntent}</th>
                <th className="text-right px-3 py-2">{i.thCpc}</th>
                <th className="text-left px-3 py-2">{i.thSource}</th>
                <th className="text-right px-3 py-2">{i.thScore}</th>
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
                      sel ? "bg-sky-teal/5" : ""
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
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.searchVolume != null ? r.searchVolume.toLocaleString(lng) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${kdClass(r.keywordDifficulty)}`}>
                      {r.keywordDifficulty != null ? r.keywordDifficulty : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {intentLabel(r.intent, i.intent)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {r.cpc != null ? `€${r.cpc.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.source === "site" ? i.sourceSite : i.sourceIdeas}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {r.opportunityScore.toLocaleString(lng)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
