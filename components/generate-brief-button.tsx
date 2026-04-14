"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerBriefNow } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function GenerateBriefButton({
  variant = "outline",
  label = "Generate brief now",
}: {
  variant?: "default" | "outline";
  label?: string;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        await triggerBriefNow();
        toast.success("Brief queued. Check the Brief page in 30-60s.");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't queue brief.");
      }
    });
  }
  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={pending}>
      <Sparkles
        className={`h-3.5 w-3.5 mr-1.5 ${pending ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
      />
      {pending ? "Queuing…" : label}
    </Button>
  );
}
