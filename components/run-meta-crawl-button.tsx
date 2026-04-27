"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerMetaCrawl } from "@/lib/actions/keywords";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | null;

export function RunMetaCrawlButton({
  label = "Crawl all pages",
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
        const res = (await triggerMetaCrawl()) as { ok?: boolean; error?: string };
        if ((res as any)?.error) {
          toast.error((res as any).error);
          return;
        }
        toast.success("Meta crawl queued. Crawling all sitemap pages + discovering orphans…");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't start crawl.");
      }
    });
  }

  const shown = pending ? "Queuing…" : isActive ? "Crawling…" : label;

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <RefreshCw
        className={`h-3.5 w-3.5 mr-1.5 ${pending || isActive ? "animate-spin" : ""}`}
        strokeWidth={1.5}
      />
      {shown}
    </Button>
  );
}
