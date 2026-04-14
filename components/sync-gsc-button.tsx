"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerGscHistoryPull } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function SyncGscButton({ days = 90, label }: { days?: number; label?: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        await triggerGscHistoryPull(days);
        toast.success(`GSC pull queued (${days}d). Watch the banner for progress.`);
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue GSC pull.");
      }
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <Download
        className={`h-3.5 w-3.5 mr-1.5 ${pending ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {pending ? "Queuing…" : label ?? `Pull ${days}d GSC history`}
    </Button>
  );
}
