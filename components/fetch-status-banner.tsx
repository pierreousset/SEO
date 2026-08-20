"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";
import { cancelStuckRun } from "@/lib/actions/keywords";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";

type Run = {
  id: string;
  source: string;
  status: "queued" | "running" | "done" | "failed" | "skipped";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  taskCount: number | null;
  resultCount: number | null;
  error: string | null;
};

function elapsed(fromIso: string, nowMs: number | null): string {
  if (nowMs == null) return "…";
  const ms = Math.max(0, nowMs - new Date(fromIso).getTime());
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function FetchStatusBanner({ run }: { run: Run | null }) {
  const router = useRouter();
  const { locale } = useLocale();
  const fr = locale === "fr";
  const [now, setNow] = useState<number | null>(null);
  const [kick, setKick] = useState(false);
  const [kickAt, setKickAt] = useState<number | null>(null);
  const [cancelling, startCancel] = useTransition();

  const startedAtIso = run?.startedAt ?? run?.queuedAt ?? null;
  const elapsedMs = startedAtIso && now != null ? now - new Date(startedAtIso).getTime() : 0;
  const isStale = now != null && elapsedMs > 10 * 60_000;
  const live = run?.status === "queued" || run?.status === "running";

  useEffect(() => setNow(Date.now()), []);

  useEffect(() => {
    const on = () => {
      setKick(true);
      setKickAt(Date.now());
    };
    window.addEventListener("seo-fetch-queued", on);
    return () => window.removeEventListener("seo-fetch-queued", on);
  }, []);

  useEffect(() => {
    if (run?.status === "queued" || run?.status === "running") setKick(false);
  }, [run?.status, run?.id]);

  useEffect(() => {
    if (!live && !kick) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [live, kick]);

  useEffect(() => {
    if (!live && !kick) return;
    if (isStale) return;
    const i = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(i);
  }, [live, kick, router, isStale]);

  function onCancel() {
    if (!run) return;
    startCancel(async () => {
      try {
        await cancelStuckRun("fetch", run.id);
        toast.success(fr ? "Fetch annulé." : "Fetch cancelled.");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't cancel");
      }
    });
  }

  const ranked = run?.resultCount ?? 0;
  const total = run?.taskCount ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((ranked / total) * 100)) : live || kick ? 12 : 0;

  const isRecentDone =
    run?.status === "done" &&
    run.finishedAt &&
    now != null &&
    now - new Date(run.finishedAt).getTime() < 3 * 60_000;

  if (kick && !live) {
    return (
      <ProgressSheet
        title={fr ? "Lancement du fetch" : "Starting fetch"}
        subtitle={fr ? "File d'attente. Les positions vont se mettre à jour." : "Queued. Rankings will refresh in place."}
        pct={8}
        indeterminate
        elapsed={kickAt ? elapsed(new Date(kickAt).toISOString(), now) : "…"}
      />
    );
  }

  if (!run) return null;

  if (run.status === "queued" || run.status === "running") {
    const title = isStale
      ? fr
        ? "Fetch bloqué"
        : "Fetch stuck"
      : run.status === "queued"
        ? fr
          ? "Positions en file"
          : "Fetch queued"
        : fr
          ? "Récupération des positions"
          : "Fetching positions";
    const subtitle = isStale
      ? fr
        ? "Le worker ne répond plus. Annulez et relancez."
        : "The worker stopped. Cancel and retry."
      : total > 0
        ? fr
          ? `${ranked} / ${total} mots-clés traités`
          : `${ranked} / ${total} keywords processed`
        : fr
          ? "Envoi des requêtes DataForSEO…"
          : "Posting tasks to DataForSEO…";
    return (
      <ProgressSheet
        title={title}
        subtitle={subtitle}
        pct={isStale ? 100 : pct}
        indeterminate={!isStale && total === 0}
        elapsed={elapsed(run.startedAt ?? run.queuedAt, now)}
        warn={isStale}
        action={
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-caption border border-current/30 hover:bg-current/10 disabled:opacity-50"
          >
            <X className="size-3" strokeWidth={2} />
            {cancelling ? (fr ? "…" : "…") : fr ? "Annuler" : "Cancel"}
          </button>
        }
      />
    );
  }

  if (isRecentDone) {
    return (
      <ProgressSheet
        title={fr ? "Positions à jour" : "Rankings updated"}
        subtitle={
          fr
            ? `${run.resultCount ?? 0} / ${run.taskCount ?? 0} mots-clés classés`
            : `${run.resultCount ?? 0} / ${run.taskCount ?? 0} keywords ranked`
        }
        pct={100}
        done
        elapsed={elapsed(run.finishedAt!, now)}
      />
    );
  }

  if (run.status === "failed") {
    const dump = run.error?.startsWith("Failed query:");
    return (
      <ProgressSheet
        title={fr ? "Fetch échoué" : "Fetch failed"}
        subtitle={dump ? (fr ? "Erreur base de données. Relancez." : "Database error. Retry.") : (run.error ?? "")}
        pct={100}
        error
      />
    );
  }

  return null;
}

function ProgressSheet({
  title,
  subtitle,
  pct,
  elapsed,
  indeterminate,
  done,
  error,
  warn,
  action,
}: {
  title: string;
  subtitle: string;
  pct: number;
  elapsed?: string;
  indeterminate?: boolean;
  done?: boolean;
  error?: boolean;
  warn?: boolean;
  action?: React.ReactNode;
}) {
  const icon = error ? (
    <XCircle className="size-4 text-hot-pink" strokeWidth={1.75} />
  ) : done ? (
    <CheckCircle2 className="size-4 text-sky-teal" strokeWidth={1.75} />
  ) : warn ? (
    <AlertTriangle className="size-4 text-vivid-violet" strokeWidth={1.75} />
  ) : (
    <Loader2 className="size-4 animate-spin text-ink-black" strokeWidth={1.75} />
  );

  return (
    <div className="sheet px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5">{icon}</span>
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-ink-black">{title}</p>
            <p className="text-caption text-ash-gray mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {elapsed ? (
            <span className="text-caption tabular-nums text-ash-gray">{elapsed}</span>
          ) : null}
          {action}
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-subtle-cream overflow-hidden">
        <div
          className={`h-full rounded-full ${
            error ? "bg-hot-pink" : done ? "bg-sky-teal" : warn ? "bg-vivid-violet" : "bg-ink-black"
          } ${indeterminate ? "w-1/3 animate-pulse" : "transition-[width] duration-500 ease-out"}`}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
