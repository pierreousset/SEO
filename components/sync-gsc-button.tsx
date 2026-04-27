"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerGscHistoryPull } from "@/lib/actions/keywords";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function SyncGscButton({
  days = 90,
  label,
  activeStatus = null,
}: {
  days?: number;
  label?: string;
  activeStatus?: RunStatus;
}) {
  const [pending, start] = useTransition();
  const isActive = activeStatus === "queued" || activeStatus === "running";
  const disabled = pending || isActive;

  function onClick() {
    if (disabled) return;
    start(async () => {
      try {
        const res = (await triggerGscHistoryPull(days)) as {
          ok?: boolean;
          error?: string;
          cappedDays?: number;
        };
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        const actualDays = res?.cappedDays ?? days;
        const note = actualDays < days ? ` (capped to ${actualDays}d on Free plan)` : "";
        toast.success(`GSC pull queued (${actualDays}d)${note}. Watch the banner for progress.`);
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue GSC pull.");
      }
    });
  }

  const shownLabel = pending
    ? "Queuing…"
    : isActive
      ? "Pulling…"
      : (label ?? `Pull ${days}d GSC history`);

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shownLabel}
    </Button>
  );
}
