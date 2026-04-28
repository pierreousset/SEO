"use client";

import { useState } from "react";

export function CopyMarkdownButton({ markdown }: { markdown: string | null }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? "Copied!" : "Copy markdown"}
    </button>
  );
}
