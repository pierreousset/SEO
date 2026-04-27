"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, XCircle, AlertTriangle, X } from "lucide-react";
import { cancelStuckRun } from "@/lib/actions/keywords";
import { toast } from "sonner";

type Run = {
  id: string;
  source: string;
  status: "queued" | "running" | "done" | "failed" | "skipped";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

function elapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function BriefStatusBanner({ run }: { run: Run | null }) {
  const router = useRouter();
  const [, setTick] = useState(0);
  const [cancelling, startCancel] = useTransition();

  const startedAtIso = run?.startedAt ?? run?.queuedAt ?? null;
  const elapsedMs = startedAtIso ? Date.now() - new Date(startedAtIso).getTime() : 0;
  const isStale = elapsedMs > 10 * 60_000;

  function onCancel() {
    if (!run) return;
    startCancel(async () => {
      try {
        await cancelStuckRun("brief", run.id);
        toast.success("Run marked as failed.");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't cancel");
      }
    });
  }

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    if (run.status !== "queued" && run.status !== "running") return;
    const i = setInterval(() => router.refresh(), 5_000); // brief is faster than fetch — poll more often
    return () => clearInterval(i);
  }, [run, router]);

  if (!run) return null;

  const isRecentDone =
    run.status === "done" &&
    run.finishedAt &&
    Date.now() - new Date(run.finishedAt).getTime() < 30_000;

  if (run.status === "queued" || run.status === "running") {
    const tone = isStale ? ("warn" as const) : ("info" as const);
    const icon = isStale ? (
      <AlertTriangle className="h-4 w-4" strokeWidth={2} />
    ) : run.status === "running" ? (
      <Sparkles className="h-4 w-4 animate-pulse" strokeWidth={2} />
    ) : (
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
    );
    return (
      <Banner tone={tone} icon={icon}>
        <span>
          {isStale ? (
            <><strong>Brief stuck</strong> · {elapsed(run.startedAt ?? run.queuedAt)} — worker died</>
          ) : run.status === "running" ? (
            <>
              <strong>Generating AI brief</strong> · Claude analyzing your data ·{" "}
              {elapsed(run.startedAt ?? run.queuedAt)}
            </>
          ) : (
            <><strong>AI brief queued</strong> · {elapsed(run.queuedAt)}</>
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
      <Banner tone="success" icon={<Sparkles className="h-4 w-4" strokeWidth={2} />}>
        <strong>Brief ready</strong> · finished {elapsed(run.finishedAt!)} ago
      </Banner>
    );
  }

  if (run.status === "failed") {
    return (
      <Banner tone="error" icon={<XCircle className="h-4 w-4" strokeWidth={2} />}>
        <strong>Brief generation failed</strong>
        {run.error && (
          <span className="text-xs opacity-80 ml-2 font-mono tabular">{run.error}</span>
        )}
      </Banner>
    );
  }

  if (run.status === "skipped") {
    return (
      <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}>
        <strong>Brief skipped</strong> — {run.error ?? "not enough data"}
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
