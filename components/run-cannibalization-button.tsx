"use client";

import { useTransition } from "react";
import { Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerCannibalizationScan } from "@/lib/actions/cannibalization";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function RunCannibalizationButton({
  label = "Run scan",
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
        const res = await triggerCannibalizationScan();
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Cannibalization scan queued. Results in 30-90s.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue scan.");
      }
    });
  }

  const shownLabel = pending ? "Queuing…" : isActive ? "Scanning…" : label;

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Split
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shownLabel}
    </Button>
  );
}
