"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ZAxis,
} from "recharts";

type DataPoint = {
  keyword: string;
  position: number;
  ctr: number; // 0-1
  impressions: number;
};

const BENCHMARK = [
  { pos: 1, ctr: 28 },
  { pos: 2, ctr: 15 },
  { pos: 3, ctr: 11 },
  { pos: 4, ctr: 6 },
  { pos: 5, ctr: 6 },
  { pos: 6, ctr: 3 },
  { pos: 7, ctr: 3 },
  { pos: 8, ctr: 3 },
  { pos: 9, ctr: 3 },
  { pos: 10, ctr: 3 },
  { pos: 15, ctr: 1 },
  { pos: 20, ctr: 1 },
  { pos: 50, ctr: 0.3 },
];

function getBenchmarkCtr(position: number): number {
  // Interpolate between benchmark data points
  for (let i = 0; i < BENCHMARK.length - 1; i++) {
    const a = BENCHMARK[i];
    const b = BENCHMARK[i + 1];
    if (position >= a.pos && position <= b.pos) {
      const t = (position - a.pos) / (b.pos - a.pos);
      return a.ctr + t * (b.ctr - a.ctr);
    }
  }
  if (position < 1) return 28;
  return 0.3;
}

type ChartPoint = {
  keyword: string;
  position: number;
  ctrPct: number;
  impressions: number;
  aboveBenchmark: boolean;
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as ChartPoint;
  return (
    <div className="rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-foreground mb-1 max-w-[200px] truncate">
        {d.keyword}
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        <div>
          Position: <span className="font-mono text-foreground tabular-nums">{d.position}</span>
        </div>
        <div>
          CTR: <span className="font-mono text-foreground tabular-nums">{d.ctrPct.toFixed(1)}%</span>
        </div>
        <div>
          Impressions: <span className="font-mono text-foreground tabular-nums">{d.impressions.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function CtrPositionScatter({ data }: { data: DataPoint[] }) {
  // Transform data for the chart
  const aboveData: ChartPoint[] = [];
  const belowData: ChartPoint[] = [];

  for (const d of data) {
    const ctrPct = d.ctr * 100;
    const benchmarkCtr = getBenchmarkCtr(d.position);
    const point: ChartPoint = {
      keyword: d.keyword,
      position: d.position,
      ctrPct,
      impressions: d.impressions,
      aboveBenchmark: ctrPct >= benchmarkCtr,
    };
    if (point.aboveBenchmark) {
      aboveData.push(point);
    } else {
      belowData.push(point);
    }
  }

  // Determine impression range for dot sizing
  const allImpressions = data.map((d) => d.impressions);
  const minImpr = Math.min(...allImpressions);
  const maxImpr = Math.max(...allImpressions);
  const sizeRange: [number, number] = [40, 400];

  // Benchmark line data (for the composed chart)
  const benchmarkLine = BENCHMARK.map((b) => ({
    position: b.pos,
    benchmark: b.ctr,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1A1A1A"
          vertical={false}
        />
        <XAxis
          dataKey="position"
          type="number"
          domain={[0, "auto"]}
          tickLine={false}
          axisLine={{ stroke: "#2A2A2A" }}
          tick={{ fontSize: 10, fill: "#71717A" }}
          label={{
            value: "Position",
            position: "insideBottom",
            offset: -2,
            style: { fontSize: 10, fill: "#71717A" },
          }}
        />
        <YAxis
          dataKey="ctrPct"
          type="number"
          domain={[0, 30]}
          tickLine={false}
          axisLine={{ stroke: "#2A2A2A" }}
          tick={{ fontSize: 10, fill: "#71717A" }}
          tickFormatter={(v: number) => `${v}%`}
          width={42}
        />
        <ZAxis
          dataKey="impressions"
          type="number"
          range={sizeRange}
          domain={[minImpr, maxImpr]}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Benchmark curve */}
        <Line
          data={benchmarkLine}
          dataKey="benchmark"
          type="monotone"
          stroke="#71717A"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          dot={false}
          isAnimationActive={false}
          legendType="none"
        />

        {/* Above benchmark — green */}
        <Scatter
          data={aboveData}
          fill="#34D399"
          fillOpacity={0.7}
          isAnimationActive={false}
        />

        {/* Below benchmark — red */}
        <Scatter
          data={belowData}
          fill="#F87171"
          fillOpacity={0.7}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
