"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Crosshair, XCircle, AlertTriangle } from "lucide-react";

type Run = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "skipped";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  competitorsScanned: number | null;
  keywordsInspected: number | null;
  gapsFound: number | null;
  costUsd: string | null;
  error: string | null;
};

// `nowMs` is null during SSR and the first client render (before mount), so the
// server and client agree and hydration doesn't mismatch on the live timer.
function elapsed(fromIso: string, nowMs: number | null): string {
  if (nowMs == null) return "…";
  const ms = nowMs - new Date(fromIso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function GapStatusBanner({ run }: { run: Run | null }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  // Set the clock once on mount (all statuses need it, e.g. isRecentDone).
  // Intentional client-only initializer so SSR/first render stay deterministic.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const i = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(i);
  }, [run, router]);

  if (!run) return null;

  const isRecentDone =
    run.status === "done" &&
    run.finishedAt &&
    now != null && now - new Date(run.finishedAt).getTime() < 60_000;

  if (run.status === "queued") {
    return (
      <Banner tone="info" icon={<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}>
        <strong>Gap scan queued</strong> · {elapsed(run.queuedAt, now)}
      </Banner>
    );
  }
  if (run.status === "running") {
    return (
      <Banner tone="info" icon={<Crosshair className="h-4 w-4 animate-pulse" strokeWidth={2} />}>
        <strong>Scanning competitors</strong> · pulling ranked keywords via DataForSEO ·{" "}
        {elapsed(run.startedAt ?? run.queuedAt, now)}
      </Banner>
    );
  }
  if (isRecentDone) {
    return (
      <Banner tone="success" icon={<Crosshair className="h-4 w-4" strokeWidth={2} />}>
        <strong>Gap scan complete</strong> · {run.competitorsScanned ?? 0} competitors ·{" "}
        {run.keywordsInspected?.toLocaleString() ?? 0} keywords inspected · {run.gapsFound ?? 0}{" "}
        gaps
        {run.costUsd && ` · $${run.costUsd}`}
      </Banner>
    );
  }
  if (run.status === "failed") {
    return (
      <Banner tone="error" icon={<XCircle className="h-4 w-4" strokeWidth={2} />}>
        <strong>Gap scan failed</strong>
        {run.error && (
          <span className="text-xs opacity-80 ml-2 font-mono tabular">{run.error}</span>
        )}
      </Banner>
    );
  }
  if (run.status === "skipped") {
    return (
      <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}>
        <strong>Gap scan skipped</strong> — {run.error ?? "no competitors"}
      </Banner>
    );
  }
  return null;
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "info" | "success" | "error" | "warn";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-[var(--up)]/10 text-[var(--up)] border-[var(--up)]/30"
      : tone === "error"
        ? "bg-[var(--down)]/10 text-[var(--down)] border-[var(--down)]/30"
        : tone === "warn"
          ? "bg-vivid-violet/10 text-vivid-violet dark:text-vivid-violet border-yellow-500/30"
          : "bg-sky-teal/10 text-sky-teal border-sky-teal/30";
  return (
    <div className={`mb-4 flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${cls}`}>
      {icon}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
