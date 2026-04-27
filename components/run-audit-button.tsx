"use client";

import { useTransition } from "react";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerSiteAudit } from "@/lib/actions/keywords";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function RunAuditButton({
  label = "Run site audit",
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
        const res = (await triggerSiteAudit()) as { ok?: boolean; error?: string };
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          "Audit queued. Free crawl + checks for everyone. AI synthesis (4 credits) for Pro users.",
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue audit.");
      }
    });
  }

  const shownLabel = pending ? "Queuing…" : isActive ? "Auditing…" : label;

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Stethoscope
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {shownLabel}
    </Button>
  );
}
