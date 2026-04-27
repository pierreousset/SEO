"use client";

import { useState, useTransition } from "react";
import { Plus, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addCompetitorFromDiscovery } from "@/lib/actions/business";
import { toast } from "sonner";

export type Suggestion = {
  domain: string;
  keywordCount: number;
  avgPosition: number;
  bestPosition: number;
};

export function CompetitorSuggestions({
  suggestions,
  remainingSlots,
}: {
  suggestions: Suggestion[];
  remainingSlots: number;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [pendingDomain, setPendingDomain] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  function onAdd(domain: string) {
    if (added.has(domain) || pending) return;
    setPendingDomain(domain);
    start(async () => {
      try {
        const res = await addCompetitorFromDiscovery(domain);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        setAdded((s) => new Set([...s, domain]));
        toast.success(`Tracking ${domain}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't add.");
      } finally {
        setPendingDomain(null);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-secondary p-6 md:p-8">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Auto-discovered
        </span>
      </div>
      <h2 className="font-display text-2xl md:text-3xl">Competitors we spotted</h2>
      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Domains that keep showing up in your top 10 across tracked keywords. Add them to unlock
        Gap, AEO showdown, and Backlinks comparison.
      </p>

      {remainingSlots === 0 ? (
        <p className="text-sm text-muted-foreground">
          You've filled all 5 competitor slots. Remove one in the form above to add a new one.
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => {
            const isAdded = added.has(s.domain);
            const isPending = pendingDomain === s.domain && pending;
            return (
              <div
                key={s.domain}
                className="flex items-center gap-3 rounded-[12px] bg-background px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono tabular text-xs truncate" title={s.domain}>
                    {s.domain}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono tabular">
                    {s.keywordCount} keyword{s.keywordCount > 1 ? "s" : ""} · avg pos{" "}
                    {s.avgPosition.toFixed(1)} · best #{s.bestPosition}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onAdd(s.domain)}
                  disabled={isAdded || isPending}
                  className="shrink-0"
                >
                  {isAdded ? (
                    <>
                      <Check className="h-3 w-3 mr-1" strokeWidth={2} />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus
                        className={`h-3 w-3 mr-1 ${isPending ? "animate-pulse" : ""}`}
                        strokeWidth={2}
                      />
                      {isPending ? "…" : "Add"}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
