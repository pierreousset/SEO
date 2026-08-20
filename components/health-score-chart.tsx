"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type ScorePoint = { date: string; score: number };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg bg-canvas-white border border-hairline px-2.5 py-1.5 text-xs shadow-subtle">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-foreground tabular-nums">
        {payload[0].value}
      </div>
    </div>
  );
}

export function HealthScoreChart({ data }: { data: ScorePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="healthScoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3dbe78" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#3dbe78" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9, fill: "#6f675f" }}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
          }}
        />
        <YAxis
          domain={[0, 100]}
          hide
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#3dbe78"
          strokeWidth={2}
          fill="url(#healthScoreFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
