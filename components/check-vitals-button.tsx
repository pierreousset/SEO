"use client";

import { useTransition } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkWebVitalsForSite } from "@/lib/actions/web-vitals";
import { toast } from "sonner";

export function CheckVitalsButton() {
  const [pending, start] = useTransition();

  function onClick() {
    if (pending) return;
    start(async () => {
      try {
        const res = await checkWebVitalsForSite();
        if ("error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        const count = "results" in res ? res.results?.length ?? 0 : 0;
        toast.success(`Checked vitals for ${count} page${count !== 1 ? "s" : ""}.`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Couldn't check vitals.";
        toast.error(msg);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <Activity
        className={`h-3.5 w-3.5 mr-1.5 ${pending ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {pending ? "Checking..." : "Check vitals"}
    </Button>
  );
}
