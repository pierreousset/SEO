"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, XCircle, AlertTriangle } from "lucide-react";

type Run = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "skipped";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  daysRequested: number | null;
  rowsFetched: number | null;
  metricsUpserted: number | null;
  error: string | null;
};

function elapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function GscStatusBanner({ run }: { run: Run | null }) {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
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
    Date.now() - new Date(run.finishedAt).getTime() < 30_000;

  if (run.status === "queued") {
    return (
      <Banner tone="info" icon={<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}>
        <strong>GSC pull queued</strong> · {elapsed(run.queuedAt)}
      </Banner>
    );
  }

  if (run.status === "running") {
    return (
      <Banner tone="info" icon={<Download className="h-4 w-4 animate-pulse" strokeWidth={2} />}>
        <strong>Pulling {run.daysRequested ?? 90}d of GSC history</strong> · this can take 30-90s ·{" "}
        {elapsed(run.startedAt ?? run.queuedAt)}
      </Banner>
    );
  }

  if (isRecentDone) {
    return (
      <Banner tone="success" icon={<Download className="h-4 w-4" strokeWidth={2} />}>
        <strong>GSC history pulled</strong> · {run.metricsUpserted ?? 0} daily metrics saved ·
        finished {elapsed(run.finishedAt!)} ago
      </Banner>
    );
  }

  if (run.status === "failed") {
    return (
      <Banner tone="error" icon={<XCircle className="h-4 w-4" strokeWidth={2} />}>
        <strong>GSC pull failed</strong>
        {run.error && (
          <span className="text-xs opacity-80 ml-2 font-mono tabular">{run.error}</span>
        )}
      </Banner>
    );
  }

  if (run.status === "skipped") {
    return (
      <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}>
        <strong>GSC pull skipped</strong> — {run.error ?? "nothing to do"}
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
          ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30"
          : "bg-primary/10 text-primary border-primary/30";
  return (
    <div className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
      {icon}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
