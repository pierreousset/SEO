"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAeoCheck } from "@/lib/actions/aeo";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function RunAeoCheckButton({
  label = "Run AEO check · 10 credits",
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
        const res = await runAeoCheck();
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("AEO check queued. This runs across all configured LLM engines.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue check.");
      }
    });
  }

  const shownLabel = pending ? "Queuing…" : isActive ? "Checking…" : label;

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Sparkles
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shownLabel}
    </Button>
  );
}
