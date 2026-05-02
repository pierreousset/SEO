"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestMetaBulk, type MetaSuggestion } from "@/lib/actions/meta-suggestions";
import { toast } from "sonner";

type BulkResult = Array<{ url: string } & MetaSuggestion>;

// Static-only labels (no functions) — passed as a prop to a "use client"
// component, so it must cross the server -> client boundary.
export type BulkMetaSuggestionLabels = {
  cta: string;
  generating: string;
  bulkAiSuggestions: string;
  pageSingular: string;
  pagePlural: string;
  title: string;
  description: string;
  generatedFor: string; // template with {n} placeholder
  noPages: string;
  failed: string;
  copy: string;
};

export const bulkMetaSuggestionLabelsEN: BulkMetaSuggestionLabels = {
  cta: "Suggest all metas · 3 credits",
  generating: "Generating…",
  bulkAiSuggestions: "Bulk AI suggestions",
  pageSingular: "page",
  pagePlural: "pages",
  title: "Title",
  description: "Description",
  generatedFor: "Generated suggestions for {n} pages.",
  noPages: "All pages already have good titles. Nothing to suggest.",
  failed: "Bulk suggestion failed.",
  copy: "Copy",
};

export const bulkMetaSuggestionLabelsFR: BulkMetaSuggestionLabels = {
  cta: "Suggérer toutes les métas · 3 crédits",
  generating: "Génération…",
  bulkAiSuggestions: "Suggestions IA en lot",
  pageSingular: "page",
  pagePlural: "pages",
  title: "Titre",
  description: "Description",
  generatedFor: "Suggestions générées pour {n} pages.",
  noPages: "Toutes les pages ont déjà de bons titres. Rien à suggérer.",
  failed: "Échec de la suggestion en lot.",
  copy: "Copier",
};

export function BulkMetaSuggestionButton({
  labels = bulkMetaSuggestionLabelsEN,
}: {
  labels?: BulkMetaSuggestionLabels;
}) {
  const [pending, start] = useTransition();
  const [results, setResults] = useState<BulkResult | null>(null);
  const [open, setOpen] = useState(false);

  function onClick() {
    if (pending) return;
    start(async () => {
      try {
        const res = await suggestMetaBulk();
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.suggestions.length === 0) {
          toast.info(labels.noPages);
          return;
        }
        setResults(res.suggestions);
        setOpen(true);
        toast.success(
          labels.generatedFor.replace("{n}", String(res.suggestions.length)),
        );
      } catch (e: any) {
        toast.error(e?.message ?? labels.failed);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" strokeWidth={1.5} />
        ) : (
          <Sparkles className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
        )}
        {pending ? labels.generating : labels.cta}
      </Button>

      {open && results && results.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <span className="text-caption text-ash-gray uppercase tracking-wider">
                  {labels.bulkAiSuggestions}
                </span>
                <h3 className="text-lg font-semibold mt-0.5">
                  {results.length}{" "}
                  {results.length === 1 ? labels.pageSingular : labels.pagePlural}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6">
              {results.map((r) => (
                <BulkResultCard
                  key={r.url}
                  result={r}
                  titleLabel={labels.title}
                  descriptionLabel={labels.description}
                  copyLabel={labels.copy}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BulkResultCard({
  result,
  titleLabel,
  descriptionLabel,
  copyLabel,
}: {
  result: { url: string } & MetaSuggestion;
  titleLabel: string;
  descriptionLabel: string;
  copyLabel: string;
}) {
  return (
    <div className="rounded-xl bg-background p-4 space-y-3">
      <div className="font-mono text-xs text-muted-foreground truncate" title={result.url}>
        {stripOrigin(result.url)}
      </div>

      <CopyField
        label={titleLabel}
        value={result.title}
        charCount={result.title.length}
        range="30-60"
        copyLabel={copyLabel}
      />
      <CopyField
        label={descriptionLabel}
        value={result.metaDescription}
        charCount={result.metaDescription.length}
        range="120-160"
        copyLabel={copyLabel}
      />

      <p className="text-[11px] text-muted-foreground leading-relaxed">{result.reasoning}</p>
    </div>
  );
}

function CopyField({
  label,
  value,
  charCount,
  range,
  copyLabel,
}: {
  label: string;
  value: string;
  charCount: number;
  range: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-caption text-ash-gray">{label}</span>
          <span className="text-caption text-ash-gray tabular">
            {charCount} ({range})
          </span>
        </div>
        <div className="text-sm">{value}</div>
      </div>
      <button
        onClick={copy}
        className="mt-3 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title={copyLabel}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[var(--up)]" strokeWidth={1.5} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

function stripOrigin(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}
