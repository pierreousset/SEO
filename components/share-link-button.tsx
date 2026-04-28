"use client";

import { useState, useTransition } from "react";
import { Share2, Check, Copy, Loader2 } from "lucide-react";
import { createShareLink } from "@/lib/actions/share";

export function ShareLinkButton({
  resourceType,
  resourceId,
}: {
  resourceType: "brief" | "audit";
  resourceId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    startTransition(async () => {
      const result = await createShareLink(resourceType, resourceId);
      setUrl(result.url);
    });
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="text-xs font-mono bg-background border border-border rounded-full px-3 py-2 w-[260px] truncate text-muted-foreground"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" strokeWidth={1.5} />
          ) : (
            <Copy className="h-3 w-3" strokeWidth={1.5} />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
      ) : (
        <Share2 className="h-3 w-3" strokeWidth={1.5} />
      )}
      Share
    </button>
  );
}
