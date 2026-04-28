"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestMetaForPage, type MetaSuggestion } from "@/lib/actions/meta-suggestions";
import { toast } from "sonner";

export function MetaSuggestionButton({ url }: { url: string }) {
  const [pending, start] = useTransition();
  const [suggestion, setSuggestion] = useState<MetaSuggestion | null>(null);
  const [open, setOpen] = useState(false);

  function onClick() {
    if (pending) return;
    start(async () => {
      try {
        const res = await suggestMetaForPage(url);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setSuggestion(res.suggestion);
        setOpen(true);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to generate suggestion.");
      }
    });
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={pending}
        className="h-7 text-[11px] px-2.5 gap-1"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
        ) : (
          <Sparkles className="h-3 w-3" strokeWidth={1.5} />
        )}
        {pending ? "Generating..." : "Suggest meta"}
      </Button>

      {open && suggestion && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[420px] rounded-xl bg-card border border-border shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              AI suggestion
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <SuggestionField
            label="Title"
            value={suggestion.title}
            charCount={suggestion.title.length}
            range="30-60 chars"
          />

          <SuggestionField
            label="Meta description"
            value={suggestion.metaDescription}
            charCount={suggestion.metaDescription.length}
            range="120-160 chars"
          />

          <div>
            <div className="font-mono text-[10px] text-muted-foreground mb-1">Reasoning</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {suggestion.reasoning}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionField({
  label,
  value,
  charCount,
  range,
}: {
  label: string;
  value: string;
  charCount: number;
  range: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground tabular">
          {charCount} chars ({range})
        </span>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 rounded-lg bg-background p-3 text-sm leading-relaxed">
          {value}
        </div>
        <button
          onClick={copy}
          className="mt-2.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--up)]" strokeWidth={1.5} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
}
