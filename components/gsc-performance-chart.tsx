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

const config = {
  clicks: { label: "Clicks", color: "var(--primary)" },
  impressions: { label: "Impressions", color: "var(--muted-foreground)" },
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
      <div className="rounded-2xl bg-secondary p-8 text-sm text-muted-foreground">
        No GSC data yet. Click <strong>Pull GSC history</strong> above to fetch up to 90 days.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex rounded-lg bg-background p-0.5">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                disabled={s.value === "site" ? siteData.length === 0 : trackedData.length === 0}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  scope === s.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg bg-background p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  range === r.days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-mono text-[10px] text-muted-foreground">clicks</span>
              <span className="font-mono text-xs font-semibold">{totals.clicks.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="font-mono text-[10px] text-muted-foreground">impressions</span>
              <span className="font-mono text-xs font-semibold">{totals.impressions.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">ctr</span>
              <span className="font-mono text-xs font-semibold">{totals.ctr.toFixed(1)}%</span>
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ChartContainer config={config} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sliced} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillClicksC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-clicks)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-clicks)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
                  }}
                />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="var(--color-clicks)"
                  strokeWidth={2}
                  fill="url(#fillClicksC)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="var(--color-impressions)"
                  strokeWidth={1}
                  fill="none"
                  dot={false}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-secondary p-6 md:p-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Performance
          </div>
          <h2 className="font-display text-2xl md:text-3xl mt-2">Search Console</h2>
          <p className="text-xs text-muted-foreground mt-2">
            {scope === "site"
              ? "All queries across the site (matches GSC default view)."
              : `Only your ${trackedData.length > 0 ? "tracked" : "0 tracked"} keywords.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="inline-flex rounded-full bg-background p-1">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                disabled={s.value === "site" ? siteData.length === 0 : trackedData.length === 0}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  scope === s.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full bg-background p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  range === r.days
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
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
      <div className="mt-1 font-display text-2xl md:text-3xl">{value}</div>
    </div>
  );
}
