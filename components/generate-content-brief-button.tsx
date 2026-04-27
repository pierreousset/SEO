"use client";

import { useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerContentBrief } from "@/lib/actions/content-brief";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | null;

export function GenerateContentBriefButton({
  keywordId,
  label = "Generate writer brief · 3 credits",
  activeStatus = null,
  variant = "outline",
}: {
  keywordId: string;
  label?: string;
  activeStatus?: RunStatus;
  variant?: "default" | "outline";
}) {
  const [pending, start] = useTransition();
  const isActive = activeStatus === "queued" || activeStatus === "running";
  const disabled = pending || isActive;

  function onClick() {
    if (disabled) return;
    start(async () => {
      try {
        const res = await triggerContentBrief(keywordId);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Writer brief queued. Results in 20-40s.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue brief.");
      }
    });
  }

  const shown = pending ? "Queuing…" : isActive ? "Generating…" : label;

  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={disabled}>
      <FileText
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shown}
    </Button>
  );
}
