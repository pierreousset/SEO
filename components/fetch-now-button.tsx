"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerFetchNow } from "@/lib/actions/keywords";
import { toast } from "sonner";

type RunStatus = "queued" | "running" | "done" | "failed" | "skipped" | null;

export function FetchNowButton({
  activeStatus = null,
  label = "Fetch now",
  runningLabel = "Récupération…",
}: {
  activeStatus?: RunStatus;
  label?: string;
  runningLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [justQueued, setJustQueued] = useState(false);
  const isActive =
    justQueued || pending || activeStatus === "queued" || activeStatus === "running";

  useEffect(() => {
    if (activeStatus === "queued" || activeStatus === "running") setJustQueued(false);
  }, [activeStatus]);

  function onClick() {
    if (isActive) return;
    start(async () => {
      try {
        setJustQueued(true);
        window.dispatchEvent(new Event("seo-fetch-queued"));
        await triggerFetchNow();
        router.refresh();
      } catch (e: any) {
        setJustQueued(false);
        toast.error(e?.message ?? "Couldn't queue fetch.");
      }
    });
  }

  const text = isActive ? runningLabel : label;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isActive}
      className="shadow-none"
      aria-busy={isActive}
    >
      <RefreshCw
        className={`h-3.5 w-3.5 mr-1.5 ${isActive ? "animate-spin" : ""}`}
        strokeWidth={1.5}
      />
      {text}
    </Button>
  );
}
