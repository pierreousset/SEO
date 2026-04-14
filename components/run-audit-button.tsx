"use client";

import { useTransition } from "react";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerSiteAudit } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function RunAuditButton({ label = "Run site audit" }: { label?: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        await triggerSiteAudit();
        toast.success("Audit queued. Check the Audit page in 30-60s.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue audit.");
      }
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <Stethoscope
        className={`h-3.5 w-3.5 mr-1.5 ${pending ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {pending ? "Queuing…" : label}
    </Button>
  );
}
