"use client";

import { useTransition } from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerCompetitorGapScan } from "@/lib/actions/gap";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function RunGapScanButton({
  label = "Run gap scan · 15 credits",
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
        const res = await triggerCompetitorGapScan();
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Gap scan queued. 1-3 minutes depending on competitors.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue scan.");
      }
    });
  }

  const shown = pending ? "Queuing…" : isActive ? "Scanning…" : label;

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Crosshair
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shown}
    </Button>
  );
}
