"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyUnclassifiedKeywords } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function ClassifyAllButton() {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        const res = await classifyUnclassifiedKeywords();
        toast.success(`Classified ${res.classified} keyword(s).`);
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't classify.");
      }
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${pending ? "animate-pulse" : ""}`} strokeWidth={1.5} />
      {pending ? "Classifying…" : "Classify intent"}
    </Button>
  );
}
