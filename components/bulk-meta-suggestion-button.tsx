"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestMetaBulk, type MetaSuggestion } from "@/lib/actions/meta-suggestions";
import { toast } from "sonner";

type BulkResult = Array<{ url: string } & MetaSuggestion>;

export function BulkMetaSuggestionButton() {
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
          toast.info("All pages already have good titles. Nothing to suggest.");
          return;
        }
        setResults(res.suggestions);
        setOpen(true);
        toast.success(`Generated suggestions for ${res.suggestions.length} pages.`);
      } catch (e: any) {
        toast.error(e?.message ?? "Bulk suggestion failed.");
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
        {pending ? "Generating..." : "Suggest all metas · 3 credits"}
      </Button>

      {open && results && results.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Bulk AI suggestions
                </span>
                <h3 className="text-lg font-semibold mt-0.5">
                  {results.length} page{results.length !== 1 ? "s" : ""}
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
                <BulkResultCard key={r.url} result={r} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BulkResultCard({ result }: { result: { url: string } & MetaSuggestion }) {
  return (
    <div className="rounded-xl bg-background p-4 space-y-3">
      <div className="font-mono text-xs text-muted-foreground truncate" title={result.url}>
        {stripOrigin(result.url)}
      </div>

      <CopyField label="Title" value={result.title} charCount={result.title.length} range="30-60" />
      <CopyField
        label="Description"
        value={result.metaDescription}
        charCount={result.metaDescription.length}
        range="120-160"
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
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
          <span className="font-mono text-[10px] text-muted-foreground tabular">
            {charCount} ({range})
          </span>
        </div>
        <div className="text-sm">{value}</div>
      </div>
      <button
        onClick={copy}
        className="mt-3 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
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
