"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import type { AuditLang } from "@/lib/audit/messages";
import { titleFromDetail, titleRewritePrompt } from "@/lib/audit/keyword-context";

export type AuditFixItem = {
  checkKey: string;
  message: string;
  countLabel: string;
  impact: string;
  fix: string | null;
  pages: Array<{ url: string; detail: string | null }>;
  keywords?: string[];
};

type Copy = {
  howToFix: string;
  pages: string;
  open: string;
  copy: string;
  copied: string;
  keywords?: string;
  tryFirst?: string;
  aiPaste?: string;
};

function shortUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const path = parsed.pathname === "/" ? parsed.host : `${parsed.host}${parsed.pathname}`;
    return path.length > 64 ? `…${path.slice(-63)}` : path;
  } catch {
    return u.length > 64 ? `…${u.slice(-63)}` : u;
  }
}

function cardText(item: AuditFixItem, copy: Copy, lang: AuditLang): string {
  if (item.keywords?.length) {
    return item.pages
      .map((p) =>
        titleRewritePrompt({
          lang,
          url: p.url,
          title: titleFromDetail(p.detail),
          keywords: item.keywords ?? [],
        }),
      )
      .join("\n\n---\n\n");
  }
  const lines = [item.message, item.countLabel, item.impact];
  if (item.fix) lines.push("", `${copy.howToFix}: ${item.fix}`);
  if (item.pages.length) {
    lines.push("", `${copy.pages}:`);
    for (const p of item.pages) {
      lines.push(p.detail ? `- ${p.url} (${p.detail})` : `- ${p.url}`);
    }
  }
  return lines.join("\n");
}

export function AuditFixCards({
  items,
  copy,
  lang,
}: {
  items: AuditFixItem[];
  copy: Copy;
  lang: AuditLang;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyCard(item: AuditFixItem) {
    try {
      await navigator.clipboard.writeText(cardText(item, copy, lang));
      setCopiedKey(item.checkKey);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {items.map((item) => {
        const open = openKey === item.checkKey;
        const copied = copiedKey === item.checkKey;
        return (
          <article
            key={item.checkKey}
            className={`sheet overflow-hidden ${open ? "md:col-span-3" : ""}`}
          >
            <div className="flex items-start">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : item.checkKey)}
                className="flex-1 min-w-0 text-left px-5 py-4 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-ink-black">{item.message}</p>
                  <p className="text-caption text-ash-gray mt-2">{item.countLabel}</p>
                  <p className="text-caption text-deep-slate mt-2 leading-relaxed">{item.impact}</p>
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-ash-gray mt-0.5 transition-transform duration-150 ${
                    open ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                />
              </button>
            </div>
            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={() => copyCard(item)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-caption ${
                  copied
                    ? "bg-sky-teal/10 text-sky-teal"
                    : "bg-subtle-cream text-ink-black hover:bg-hairline"
                }`}
              >
                {copied ? (
                  <Check className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={1.75} />
                )}
                {copied ? copy.copied : copy.copy}
              </button>
            </div>

            {open && (
              <div className="px-5 pb-5 border-t border-hairline">
                {item.keywords && item.keywords.length > 0 && (
                  <div className="pt-4">
                    <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                      {copy.keywords}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {item.keywords.map((k, idx) => (
                        <li
                          key={k}
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-caption ${
                            idx === 0
                              ? "bg-ink-black text-canvas-white"
                              : "bg-subtle-cream text-ink-black"
                          }`}
                        >
                          {k}
                          {idx === 0 && copy.tryFirst ? (
                            <span className="opacity-70">{copy.tryFirst}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.fix && (
                  <div className="pt-4">
                    <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                      {copy.howToFix}
                    </p>
                    <p className="text-body-sm text-ink-black mt-1.5 leading-relaxed">{item.fix}</p>
                  </div>
                )}
                <div className="pt-4">
                  <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                    {copy.pages}
                  </p>
                  <ul className="mt-2 divide-y divide-hairline">
                    {item.pages.map((p) => (
                      <li key={p.url} className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-body-sm text-ink-black truncate" title={p.url}>
                            {shortUrl(p.url)}
                          </p>
                          {p.detail && (
                            <p className="text-caption text-ash-gray mt-1">{p.detail}</p>
                          )}
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-caption text-sky-teal shrink-0 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {copy.open}
                          <ExternalLink className="size-3" strokeWidth={1.75} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
