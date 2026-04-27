"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerBriefNow } from "@/lib/actions/keywords";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function GenerateBriefButton({
  variant = "outline",
  label = "Generate brief now",
  activeStatus = null,
}: {
  variant?: "default" | "outline";
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
        const res = (await triggerBriefNow()) as { ok?: boolean; error?: string };
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Brief queued. Check the Brief page in 30-60s.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue brief.");
      }
    });
  }

  // Manual regenerate costs 2 credits. The first auto brief (Monday cron) is free for Pro.
  const isRegenerate = label.toLowerCase().includes("regenerate");
  const labelWithCost =
    isRegenerate && !pending && !isActive ? `${label} · 2 credits` : label;
  const shownLabel = pending ? "Queuing…" : isActive ? "Generating…" : labelWithCost;

  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={disabled}>
      <Sparkles
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shownLabel}
    </Button>
  );
}
