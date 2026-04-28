"use client";

import nextDynamic from "next/dynamic";

export const GscPerformanceChart = nextDynamic(
  () => import("@/components/gsc-performance-chart").then((m) => ({ default: m.GscPerformanceChart })),
  { loading: () => <div className="h-[280px] bg-card rounded-2xl animate-pulse" />, ssr: false },
);

export const CtrPositionScatter = nextDynamic(
  () => import("@/components/ctr-position-scatter").then((m) => ({ default: m.CtrPositionScatter })),
  { loading: () => <div className="h-[280px] bg-card rounded-2xl animate-pulse" />, ssr: false },
);

export const HealthScoreChart = nextDynamic(
  () => import("@/components/health-score-chart").then((m) => ({ default: m.HealthScoreChart })),
  { loading: () => <div className="h-[200px] bg-card rounded-2xl animate-pulse" />, ssr: false },
);
