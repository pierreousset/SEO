"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState, useCallback } from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseFiltersFromSearchParams } from "@/lib/keyword-filters";

const INTENT_OPTIONS = [
  { value: "4", label: "S4 — ready to hire" },
  { value: "3", label: "S3 — comparing" },
  { value: "2", label: "S2 — researching" },
  { value: "1", label: "S1 — unaware" },
  { value: "0", label: "Unclassified" },
];

const DIAG_OPTIONS = [
  { value: "gap_zone", label: "Gap zone (5-20)" },
  { value: "momentum", label: "Momentum" },
  { value: "lost_ground", label: "Lost ground" },
  { value: "weak_ctr", label: "Weak CTR" },
  { value: "low_authority", label: "Needs links" },
  { value: "stale", label: "Stale" },
  { value: "top", label: "Top (1-4)" },
  { value: "unranked", label: "Unranked" },
];

const POSITION_RANGES = [
  { value: "all", label: "All" },
  { value: "1-3", label: "Top 3" },
  { value: "4-10", label: "4-10" },
  { value: "5-20", label: "Gap zone (5-20)" },
  { value: "11-20", label: "11-20" },
  { value: "21-50", label: "21-50" },
  { value: "51-100", label: "51-100" },
  { value: "unranked", label: "Unranked" },
];

const MOVEMENT = [
  { value: "all", label: "All" },
  { value: "up", label: "Movers up" },
  { value: "down", label: "Movers down" },
  { value: "stable", label: "Stable" },
];

const COMP_FILTER = [
  { value: "all", label: "All" },
  { value: "behind", label: "Competitor outranks me" },
  { value: "ahead", label: "I outrank competitors" },
];

export function KeywordsFilterBar({ totalCount, filteredCount }: { totalCount: number; filteredCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(true);

  const filters = parseFiltersFromSearchParams(sp);

  const update = useCallback(
    (mut: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(sp.toString());
      mut(next);
      // Strip empty values so the URL stays clean
      for (const [k, v] of Array.from(next.entries())) {
        if (!v || v === "all" || v === "0") next.delete(k);
      }
      start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [sp, router, pathname],
  );

  function toggleArrayParam(key: "intent" | "diag", value: string) {
    update((next) => {
      const current = (next.get(key) ?? "").split(",").filter(Boolean);
      const has = current.includes(value);
      const after = has ? current.filter((v) => v !== value) : [...current, value];
      if (after.length === 0) next.delete(key);
      else next.set(key, after.join(","));
    });
  }

  function setStringParam(key: string, value: string) {
    update((next) => {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    });
  }

  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.intents.length > 0 ? 1 : 0) +
    (filters.diagnostics.length > 0 ? 1 : 0) +
    (filters.position !== "all" ? 1 : 0) +
    (filters.movement !== "all" ? 1 : 0) +
    (filters.minImpressions > 0 ? 1 : 0) +
    (filters.comp !== "all" ? 1 : 0);

  function reset() {
    start(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="rounded-[20px] bg-secondary/40 border border-border">
      <div className="flex items-center gap-3 p-4 flex-wrap">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80"
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold rounded-full bg-foreground text-background">
              {activeCount}
            </span>
          )}
        </button>

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={filters.q}
            onChange={(e) => setStringParam("q", e.target.value)}
            placeholder="Search keyword…"
            className="h-9 pl-9 rounded-full"
          />
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground font-mono tabular">
          {filteredCount}/{totalCount} {pending && "·"}
          {activeCount > 0 && (
            <button
              onClick={reset}
              className="ml-1 inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <X className="h-3 w-3" strokeWidth={2} /> Reset
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <FilterGroup label="Intent stage">
            {INTENT_OPTIONS.map((o) => (
              <Pill
                key={o.value}
                active={filters.intents.includes(o.value)}
                onClick={() => toggleArrayParam("intent", o.value)}
              >
                {o.label}
              </Pill>
            ))}
          </FilterGroup>

          <FilterGroup label="Diagnostic">
            {DIAG_OPTIONS.map((o) => (
              <Pill
                key={o.value}
                active={filters.diagnostics.includes(o.value)}
                onClick={() => toggleArrayParam("diag", o.value)}
              >
                {o.label}
              </Pill>
            ))}
          </FilterGroup>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectGroup
              label="Position"
              value={filters.position}
              options={POSITION_RANGES}
              onChange={(v) => setStringParam("pos", v)}
            />
            <SelectGroup
              label="7-day movement"
              value={filters.movement}
              options={MOVEMENT}
              onChange={(v) => setStringParam("mov", v)}
            />
            <SelectGroup
              label="Competitor"
              value={filters.comp}
              options={COMP_FILTER}
              onChange={(v) => setStringParam("comp", v)}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Min impressions (GSC, last 30d)
            </label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                type="number"
                min={0}
                value={filters.minImpressions}
                onChange={(e) => setStringParam("imp", e.target.value)}
                placeholder="0"
                className="h-9 w-32 rounded-full"
              />
              <div className="text-xs text-muted-foreground">
                Hide low-noise keywords. 0 = show all.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SelectGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full h-9 rounded-full bg-background border border-input px-4 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
