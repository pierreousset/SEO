"use client";

import { useState, useTransition } from "react";
import { Code, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSchemaMarkup } from "@/lib/actions/schema-generator";
import { toast } from "sonner";

export function SchemaGeneratorButton({ url }: { url: string }) {
  const [pending, start] = useTransition();
  const [jsonLd, setJsonLd] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onClick() {
    if (pending) return;
    start(async () => {
      try {
        const res = await generateSchemaMarkup(url);
        if ("error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        if ("jsonLd" in res && res.jsonLd) {
          setJsonLd(res.jsonLd);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Schema generation failed.";
        toast.error(msg);
      }
    });
  }

  async function handleCopy() {
    if (!jsonLd) return;
    await navigator.clipboard.writeText(jsonLd);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={pending}
        className="h-7 px-2 text-[10px]"
      >
        <Code className={`h-3 w-3 mr-1 ${pending ? "animate-pulse" : ""}`} strokeWidth={1.5} />
        {pending ? "..." : "Schema"}
      </Button>

      {jsonLd && (
        <div className="mt-2 bg-background rounded-xl p-4 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute top-2 right-2 h-6 w-6 p-0"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[#34D399]" strokeWidth={2} />
            ) : (
              <Copy className="h-3 w-3" strokeWidth={1.5} />
            )}
          </Button>
          <pre className="font-mono text-xs max-h-[200px] overflow-auto whitespace-pre-wrap break-all pr-8">
            {jsonLd}
          </pre>
        </div>
      )}
    </div>
  );
}
