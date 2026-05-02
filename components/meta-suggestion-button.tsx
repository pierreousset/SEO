"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestMetaForPage, type MetaSuggestion } from "@/lib/actions/meta-suggestions";
import { toast } from "sonner";

export type MetaSuggestionLabels = {
  suggestMeta: string;
  generating: string;
  aiSuggestion: string;
  title: string;
  metaDescription: string;
  titleRange: string;
  metaRange: string;
  reasoning: string;
  charsUnit: string;
  copy: string;
  copied: string;
  failedGenerate: string;
};

export const metaSuggestionLabelsEN: MetaSuggestionLabels = {
  suggestMeta: "Suggest meta",
  generating: "Generating…",
  aiSuggestion: "AI suggestion",
  title: "Title",
  metaDescription: "Meta description",
  titleRange: "30-60 chars",
  metaRange: "120-160 chars",
  reasoning: "Reasoning",
  charsUnit: "chars",
  copy: "Copy",
  copied: "Copied",
  failedGenerate: "Failed to generate suggestion.",
};

export const metaSuggestionLabelsFR: MetaSuggestionLabels = {
  suggestMeta: "Suggérer méta",
  generating: "Génération…",
  aiSuggestion: "Suggestion IA",
  title: "Titre",
  metaDescription: "Méta description",
  titleRange: "30-60 car.",
  metaRange: "120-160 car.",
  reasoning: "Raisonnement",
  charsUnit: "car.",
  copy: "Copier",
  copied: "Copié",
  failedGenerate: "Échec de la génération de la suggestion.",
};

export function MetaSuggestionButton({
  url,
  labels = metaSuggestionLabelsEN,
}: {
  url: string;
  labels?: MetaSuggestionLabels;
}) {
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
        toast.error(e?.message ?? labels.failedGenerate);
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
        {pending ? labels.generating : labels.suggestMeta}
      </Button>

      {open && suggestion && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[420px] rounded-xl bg-card border border-border shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-caption text-ash-gray uppercase tracking-wider">
              {labels.aiSuggestion}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <SuggestionField
            label={labels.title}
            value={suggestion.title}
            charCount={suggestion.title.length}
            range={labels.titleRange}
            charsUnit={labels.charsUnit}
            copyLabel={labels.copy}
            copiedLabel={labels.copied}
          />

          <SuggestionField
            label={labels.metaDescription}
            value={suggestion.metaDescription}
            charCount={suggestion.metaDescription.length}
            range={labels.metaRange}
            charsUnit={labels.charsUnit}
            copyLabel={labels.copy}
            copiedLabel={labels.copied}
          />

          <div>
            <div className="text-caption text-ash-gray mb-1">{labels.reasoning}</div>
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
  charsUnit,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  charCount: number;
  range: string;
  charsUnit: string;
  copyLabel: string;
  copiedLabel: string;
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
        <span className="text-caption text-ash-gray">{label}</span>
        <span className="text-caption text-ash-gray tabular">
          {charCount} {charsUnit} ({range})
        </span>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 rounded-lg bg-background p-3 text-sm leading-relaxed">
          {value}
        </div>
        <button
          onClick={copy}
          className="mt-2.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={copied ? copiedLabel : copyLabel}
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
