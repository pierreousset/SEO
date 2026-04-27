"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerFetchNow } from "@/lib/actions/keywords";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function FetchNowButton({ activeStatus = null }: { activeStatus?: RunStatus }) {
  const [pending, start] = useTransition();
  const isActive = activeStatus === "queued" || activeStatus === "running";
  const disabled = pending || isActive;

  function onClick() {
    if (disabled) return;
    start(async () => {
      try {
        await triggerFetchNow();
        toast.success("Fetch queued. Results in 2-5 minutes.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue fetch.");
      }
    });
  }

  const label = pending ? "Queuing…" : isActive ? "Running…" : "Fetch now";

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <RefreshCw
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-spin" : ""}`}
        strokeWidth={1.5}
      />
      {label}
    </Button>
  );
}
