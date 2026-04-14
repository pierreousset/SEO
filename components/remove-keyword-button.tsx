"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeKeyword } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function RemoveKeywordButton({ keywordId }: { keywordId: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("Stop tracking this keyword?")) return;
    start(async () => {
      try {
        await removeKeyword(keywordId);
        toast.success("Removed.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't remove.");
      }
    });
  }
  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label="Remove keyword"
      className="text-muted-foreground hover:text-foreground disabled:opacity-40"
    >
      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
    </button>
  );
}
