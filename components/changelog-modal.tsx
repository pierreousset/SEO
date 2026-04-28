"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";

const CHANGELOG = [
  {
    version: "1.3.0",
    date: "Apr 28, 2026",
    items: [
      "Blog article generator — create SEO-optimized content from your keywords",
      "Custom API keys — bring your own Claude, Gemini, HuggingFace, or Nvidia keys",
      "Share briefs & audits — generate public read-only links for clients",
      "Position alerts — get notified when keywords drop out of top positions",
      "Keyword groups/tags — organize keywords by theme or priority",
      "Command palette (Cmd+K) — search pages and actions from anywhere",
      "Chat history sidebar — browse and switch between conversations",
      "CSV export for keywords, metas, and audit findings",
    ],
  },
  {
    version: "1.2.0",
    date: "Apr 27, 2026",
    items: [
      "Dark bento redesign — new visual system with purple accent",
      "Team invites — share your account with collaborators",
      "Expandable mini sidebar with icon-only mode",
      "Full site meta crawler — sitemap parsing + orphan detection",
      "Chat switched to Haiku 4.5 (3x cheaper, included in Pro)",
      "Credit system — cancelled Pros can still burn their balance",
    ],
  },
  {
    version: "1.1.0",
    date: "Apr 15, 2026",
    items: [
      "Stripe billing — Pro subscription + credit packs",
      "AI weekly brief with email delivery",
      "Site audit with AI synthesis",
      "AEO visibility checks (Perplexity, Claude, OpenAI)",
      "Competitor gap scan via DataForSEO",
    ],
  },
];

export function ChangelogModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        title="What's new"
      >
        <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[101] bg-card rounded-2xl border border-border w-full max-w-[520px] max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold">What's new</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-8">
              {CHANGELOG.map((release) => (
                <div key={release.version}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-sm font-semibold">
                      v{release.version}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {release.date}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {release.items.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
