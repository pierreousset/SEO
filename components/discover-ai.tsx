"use client";

import { useState, useMemo, useTransition } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestKeywordsWithAI, bulkAddKeywords } from "@/lib/actions/discover";
import type { KeywordSuggestion } from "@/lib/llm/keyword-suggestions";
import { toast } from "sonner";

const STAGE_LABEL: Record<number, string> = {
  1: "S1",
  2: "S2",
  3: "S3",
  4: "S4",
};
const STAGE_TONE: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-muted text-muted-foreground",
  3: "bg-primary/10 text-primary",
  4: "bg-[var(--up)]/10 text-[var(--up)] font-semibold",
};

export function DiscoverAi() {
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KeywordSuggestion[]>([]);
  const [search, setSearch] = useState("");
  const [filterCluster, setFilterCluster] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await suggestKeywordsWithAI();
      if (res.error) setError(res.error);
      setData(res.suggestions);
    } catch (e: any) {
      setError(e?.message ?? "AI generation failed");
    } finally {
      setLoading(false);
    }
  }

  const clusters = useMemo(() => {
    const s = new Set(data.map((d) => d.topical_cluster));
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const lc = search.toLowerCase();
      rows = rows.filter(
        (r) => r.keyword.toLowerCase().includes(lc) || r.reason.toLowerCase().includes(lc),
      );
    }
    if (filterCluster) rows = rows.filter((r) => r.topical_cluster === filterCluster);
    return rows;
  }, [data, search, filterCluster]);

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
        <Button variant="outline" size="sm" onClick={generate}>
          Retry
        </Button>
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <div className="rounded-2xl bg-secondary p-8 text-sm">
        <p className="text-muted-foreground mb-4">
          Claude reads your business context + tracked keywords + GSC history and generates 20-30
          NEW keyword candidates you're not tracking yet. Clusters them by topic. Takes ~30s.
        </p>
        <Button onClick={generate}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Generate suggestions · 2 credits
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
          placeholder="Filter suggestions…"
          className="h-9 rounded-full max-w-xs"
        />
        <select
          value={filterCluster}
          onChange={(e) => setFilterCluster(e.target.value)}
          className="h-9 rounded-full bg-background border border-input px-3 text-xs"
        >
          <option value="">All clusters ({clusters.length})</option>
          {clusters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground font-mono tabular ml-auto">
          {filtered.length} shown {selected.size > 0 && `· ${selected.size} selected`}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
            <Sparkles className={`h-3 w-3 mr-1.5 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Generating…" : "Regenerate · 2 credits"}
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
          Claude is thinking about your business and generating candidates…
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => {
            const sel = selected.has(r.keyword);
            return (
              <div
                key={i}
                onClick={() => toggle(r.keyword)}
                className={`rounded-[12px] border p-4 cursor-pointer transition-colors ${
                  sel ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggle(r.keyword)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 accent-foreground"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{r.keyword}</span>
                      <span
                        className={`inline-block text-[10px] uppercase font-medium px-1.5 py-0.5 rounded-sm font-mono tabular ${STAGE_TONE[r.intent_stage]}`}
                      >
                        {STAGE_LABEL[r.intent_stage]}
                      </span>
                      <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        {r.topical_cluster}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {r.reason}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
