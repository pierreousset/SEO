"use client";

import { useTransition } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerBacklinkPull } from "@/lib/actions/backlinks";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function RunBacklinkPullButton({
  label = "Pull backlinks · 30 credits",
  activeStatus = null,
}: {
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
        const res = await triggerBacklinkPull();
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Backlink pull queued. Results in 30-90s.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue pull.");
      }
    });
  }

  const shown = pending ? "Queuing…" : isActive ? "Pulling…" : label;

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Link2
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shown}
    </Button>
  );
}
