"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2, XCircle, AlertTriangle } from "lucide-react";

type Run = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "skipped";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalBacklinks: number | null;
  referringDomains: number | null;
  costUsd: string | null;
  error: string | null;
};

function elapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function BacklinkStatusBanner({ run }: { run: Run | null }) {
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
    Date.now() - new Date(run.finishedAt).getTime() < 60_000;

  if (run.status === "queued") {
    return (
      <Banner tone="info" icon={<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}>
        <strong>Backlink pull queued</strong> · {elapsed(run.queuedAt)}
      </Banner>
    );
  }
  if (run.status === "running") {
    return (
      <Banner tone="info" icon={<Link2 className="h-4 w-4 animate-pulse" strokeWidth={2} />}>
        <strong>Pulling backlinks</strong> · summary + top 100 links + top 100 ref domains ·{" "}
        {elapsed(run.startedAt ?? run.queuedAt)}
      </Banner>
    );
  }
  if (isRecentDone) {
    return (
      <Banner tone="success" icon={<Link2 className="h-4 w-4" strokeWidth={2} />}>
        <strong>Pull complete</strong> · {(run.totalBacklinks ?? 0).toLocaleString()} backlinks
        across {(run.referringDomains ?? 0).toLocaleString()} ref domains
        {run.costUsd && ` · $${run.costUsd}`}
      </Banner>
    );
  }
  if (run.status === "failed") {
    return (
      <Banner tone="error" icon={<XCircle className="h-4 w-4" strokeWidth={2} />}>
        <strong>Pull failed</strong>
        {run.error && (
          <span className="text-xs opacity-80 ml-2 font-mono tabular">{run.error}</span>
        )}
      </Banner>
    );
  }
  if (run.status === "skipped") {
    return (
      <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}>
        <strong>Pull skipped</strong> — {run.error ?? "not ready"}
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
    <div className={`mb-4 flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${cls}`}>
      {icon}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
