"use client";

import { useState, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type DailyPoint = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  position: number;
};

const RANGES = [
  { label: "7d", days: 7 },
  { label: "28d", days: 28 },
  { label: "90d", days: 90 },
] as const;

const SCOPES = [
  { value: "site", label: "All site" },
  { value: "tracked", label: "Tracked only" },
] as const;

const GROWTH = "#3dbe78";
const EFFORT = "#5b87d6";

const config = {
  clicks: { label: "Clicks", color: GROWTH },
  impressions: { label: "Impressions", color: EFFORT },
} satisfies ChartConfig;

export function GscPerformanceChart({
  trackedData,
  siteData,
  compact = false,
}: {
  trackedData: DailyPoint[];
  siteData: DailyPoint[];
  compact?: boolean;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["days"]>(28);
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>(
    siteData.length > 0 ? "site" : "tracked",
  );

  const data = scope === "site" ? siteData : trackedData;

  const sliced = useMemo(() => {
    if (data.length === 0) return [];
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data
      .filter((d) => d.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, range]);

  const totals = useMemo(() => {
    const tc = sliced.reduce((s, d) => s + d.clicks, 0);
    const ti = sliced.reduce((s, d) => s + d.impressions, 0);
    const tCtr = ti > 0 ? (tc / ti) * 100 : 0;
    const tPos =
      sliced.length > 0
        ? sliced.filter((d) => d.position > 0).reduce((s, d) => s + d.position, 0) /
          Math.max(1, sliced.filter((d) => d.position > 0).length)
        : 0;
    return { clicks: tc, impressions: ti, ctr: tCtr, position: tPos };
  }, [sliced]);

  if (trackedData.length === 0 && siteData.length === 0) {
    return (
      <div className="sheet p-8 text-sm text-ash-gray">
        No GSC data yet. Click <strong className="text-ink-black">Pull GSC history</strong> above to fetch up to 90 days.
      </div>
    );
  }

  if (compact) {
    const maxClicks = Math.max(1, ...sliced.map((d) => d.clicks));
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="text-body font-medium text-ink-black">Search Console</h3>
          <p className="text-caption text-ash-gray rounded-full bg-subtle-cream px-2.5 py-1 shrink-0">
            {range}d
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <p className="text-caption text-ash-gray">Clicks</p>
            <p className="mt-1 font-semibold tabular-nums text-ink-black tracking-[-0.04em] text-[clamp(1.75rem,4vw,2.35rem)] leading-none">
              {totals.clicks.toLocaleString()}
            </p>
          </div>
          <ul className="flex flex-col gap-1 text-caption sm:items-end">
            <li className="flex items-center gap-2 text-deep-slate">
              <span className="size-2 rounded-full" style={{ background: GROWTH }} />
              clicks
              <span className="tabular-nums text-ink-black font-medium">{totals.clicks.toLocaleString()}</span>
            </li>
            <li className="flex items-center gap-2 text-deep-slate">
              <span className="size-2 rounded-full" style={{ background: EFFORT }} />
              impressions
              <span className="tabular-nums text-ink-black font-medium">{totals.impressions.toLocaleString()}</span>
            </li>
          </ul>
        </div>
        <div className="flex-1 min-h-[140px] flex items-end gap-[3px]">
          {sliced.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.clicks} clicks`}
              className="flex-1 rounded-t-[3px] min-h-[3px]"
              style={{
                height: `${Math.max(3, (d.clicks / maxClicks) * 100)}%`,
                background: GROWTH,
              }}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="seg">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScope(s.value)}
                disabled={s.value === "site" ? siteData.length === 0 : trackedData.length === 0}
                aria-pressed={scope === s.value}
                className="seg-btn"
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="seg">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRange(r.days)}
                aria-pressed={range === r.days}
                className="seg-btn"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet p-6 md:p-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Performance
          </div>
          <h2 className="text-heading mt-2">Search Console</h2>
          <p className="text-xs text-muted-foreground mt-2">
            {scope === "site"
              ? "All queries across the site (matches GSC default view)."
              : `Only your ${trackedData.length > 0 ? "tracked" : "0 tracked"} keywords.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="seg">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScope(s.value)}
                disabled={s.value === "site" ? siteData.length === 0 : trackedData.length === 0}
                aria-pressed={scope === s.value}
                className="seg-btn"
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="seg">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRange(r.days)}
                aria-pressed={range === r.days}
                className="seg-btn"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip — clicks, impressions, CTR, avg position */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Kpi label="Clicks" value={totals.clicks.toLocaleString()} dot="bg-primary" />
        <Kpi
          label="Impressions"
          value={totals.impressions.toLocaleString()}
          dot="bg-muted-foreground"
        />
        <Kpi label="Avg CTR" value={`${totals.ctr.toFixed(1)}%`} />
        <Kpi
          label="Avg position"
          value={totals.position > 0 ? totals.position.toFixed(1) : "—"}
        />
      </div>

      <ChartContainer config={config} className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sliced} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-clicks)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-clicks)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillImpr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-impressions)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-impressions)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => {
                const d = new Date(value);
                return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={50}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => {
                    const d = new Date(value);
                    return d.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
              }
            />
            <Area
              yAxisId="right"
              dataKey="impressions"
              type="monotone"
              fill="url(#fillImpr)"
              stroke="var(--color-impressions)"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            <Area
              yAxisId="left"
              dataKey="clicks"
              type="monotone"
              fill="url(#fillClicks)"
              stroke="var(--color-clicks)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

function Kpi({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {dot && <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </div>
      <div className="mt-1 text-heading">{value}</div>
    </div>
  );
}
