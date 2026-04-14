"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerFetchNow } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function FetchNowButton() {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        await triggerFetchNow();
        toast.success("Fetch queued. Results in 2-5 minutes.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue fetch.");
      }
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <RefreshCw
        className={`h-3.5 w-3.5 mr-1.5 ${pending ? "animate-spin" : ""}`}
        strokeWidth={1.5}
      />
      {pending ? "Queuing…" : "Fetch now"}
    </Button>
  );
}
