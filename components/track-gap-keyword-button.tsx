"use client";

import { useTransition, useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackGapKeyword } from "@/lib/actions/gap";
import { toast } from "sonner";

export function TrackGapKeywordButton({
  keyword,
  country = "fr",
}: {
  keyword: string;
  country?: string;
}) {
  const [pending, start] = useTransition();
  const [tracked, setTracked] = useState(false);

  function onClick() {
    if (pending || tracked) return;
    start(async () => {
      try {
        const res = await trackGapKeyword(keyword, country);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        setTracked(true);
        toast.success(`Tracking "${keyword}"`);
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't track.");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={onClick}
      disabled={pending || tracked}
      className="shrink-0"
    >
      {tracked ? (
        <>
          <Check className="h-3 w-3 mr-1" strokeWidth={2} />
          Tracked
        </>
      ) : (
        <>
          <Plus className={`h-3 w-3 mr-1 ${pending ? "animate-pulse" : ""}`} strokeWidth={2} />
          {pending ? "…" : "Track"}
        </>
      )}
    </Button>
  );
}
