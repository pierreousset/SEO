"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, XCircle, AlertTriangle, X } from "lucide-react";
import { cancelStuckRun } from "@/lib/actions/keywords";
import { toast } from "sonner";

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

export function GscStatusBanner({ run }: { run: Run | null }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  // Set the clock once on mount (all statuses need it, e.g. isRecentDone).
  // Intentional client-only initializer so SSR/first render stay deterministic.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);
  const [cancelling, startCancel] = useTransition();

  // Compute elapsed seconds since the run started/queued — used to detect stale orphans.
  const startedAtIso = run?.startedAt ?? run?.queuedAt ?? null;
  const elapsedMs = startedAtIso && now != null ? now - new Date(startedAtIso).getTime() : 0;
  const isStale = now != null && elapsedMs > 10 * 60_000; // > 10 min = the worker almost certainly died

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    // Don't keep hammering router.refresh() on stale orphans — it won't change
    if (isStale) return;
    const i = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(i);
  }, [run, router, isStale]);

  function onCancel() {
    if (!run) return;
    startCancel(async () => {
      try {
        await cancelStuckRun("gsc", run.id);
        toast.success("Run marked as failed. You can trigger a new one.");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't cancel");
      }
    });
  }

  if (!run) return null;

  const isRecentDone =
    run.status === "done" &&
    run.finishedAt &&
    now != null && now - new Date(run.finishedAt).getTime() < 30_000;

  if (run.status === "queued" || run.status === "running") {
    const isRunning = run.status === "running";
    const icon = isStale ? (
      <AlertTriangle className="h-4 w-4" strokeWidth={2} />
    ) : isRunning ? (
      <Download className="h-4 w-4 animate-pulse" strokeWidth={2} />
    ) : (
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
    );
    const tone = isStale ? ("warn" as const) : ("info" as const);

    return (
      <Banner tone={tone} icon={icon}>
        <span>
          {isStale ? (
            <>
              <strong>GSC pull stuck</strong> · running for {elapsed(run.startedAt ?? run.queuedAt, now)} —
              the worker likely crashed. Cancel and retry.
            </>
          ) : isRunning ? (
            <>
              <strong>Pulling {run.daysRequested ?? 90}d of GSC history</strong> · 30-90s ·{" "}
              {elapsed(run.startedAt ?? run.queuedAt, now)}
            </>
          ) : (
            <>
              <strong>GSC pull queued</strong> · {elapsed(run.queuedAt, now)}
            </>
          )}
        </span>
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="ml-3 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border border-current/30 hover:bg-current/10 disabled:opacity-50"
        >
          <X className="h-3 w-3" strokeWidth={2} />
          {cancelling ? "Cancelling…" : "Cancel"}
        </button>
      </Banner>
    );
  }

  if (isRecentDone) {
    return (
      <Banner tone="success" icon={<Download className="h-4 w-4" strokeWidth={2} />}>
        <strong>GSC history pulled</strong> · {run.metricsUpserted ?? 0} daily metrics saved ·
        finished {elapsed(run.finishedAt!, now)} ago
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
          ? "bg-vivid-violet/10 text-vivid-violet dark:text-vivid-violet border-yellow-500/30"
          : "bg-sky-teal/10 text-sky-teal border-sky-teal/30";
  return (
    <div className={`mb-4 flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${cls}`}>
      {icon}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
