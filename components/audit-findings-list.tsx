"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { inspectHint } from "@/lib/audit/inspect";
import type { AuditLang } from "@/lib/audit/messages";
import { titleFromDetail, titleRewritePrompt } from "@/lib/audit/keyword-context";

export type AuditFindingRow = {
  id: string;
  url: string;
  checkKey: string;
  severity: string;
  category: string;
  message: string;
  detail: string | null;
  fix: string | null;
  keywords: string[];
};

type Copy = {
  howToFix: string;
  seen: string;
  inspect: string;
  selector: string;
  open: string;
  copy: string;
  copied: string;
  keywords: string;
  tryFirst: string;
  aiPaste: string;
  severity: Record<string, string>;
};

const TONE: Record<string, string> = {
  high: "bg-[var(--down)]/10 text-[var(--down)]",
  medium: "bg-vivid-violet/10 text-vivid-violet",
  low: "bg-subtle-cream text-ash-gray",
  info: "bg-sky-teal/10 text-sky-teal",
};

function shortUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const path = parsed.pathname === "/" ? parsed.host : `${parsed.host}${parsed.pathname}`;
    return path.length > 72 ? `…${path.slice(-71)}` : path;
  } catch {
    return u.length > 72 ? `…${u.slice(-71)}` : u;
  }
}

export function AuditFindingsList({
  groups,
  copy,
  lang,
}: {
  groups: Array<{ url: string; countLabel: string; items: AuditFindingRow[] }>;
  copy: Copy;
  lang: AuditLang;
}) {
  const [openUrl, setOpenUrl] = useState<string | null>(groups[0]?.url ?? null);
  const [openFinding, setOpenFinding] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  function findingText(f: AuditFindingRow): string {
    if (f.keywords.length > 0) {
      return titleRewritePrompt({
        lang,
        url: f.url,
        title: titleFromDetail(f.detail),
        keywords: f.keywords,
      });
    }
    const inspect = inspectHint(f.checkKey, lang, f.url);
    const lines = [
      f.message,
      `${copy.severity[f.severity] ?? f.severity} · ${f.category}`,
      f.url,
    ];
    if (f.detail) lines.push("", `${copy.seen}: ${f.detail}`);
    if (f.fix) lines.push("", `${copy.howToFix}: ${f.fix}`);
    if (inspect) {
      lines.push("", `${copy.inspect}: ${inspect.hint}`, `${copy.selector}: ${inspect.selector}`);
    }
    return lines.join("\n");
  }

  function groupText(group: { url: string; countLabel: string; items: AuditFindingRow[] }): string {
    return [group.url, group.countLabel, "", ...group.items.map(findingText)].join("\n\n");
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const open = openUrl === group.url;
        return (
          <article key={group.url} className="sheet overflow-hidden">
            <div className="flex items-stretch">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpenUrl(open ? null : group.url);
                  setOpenFinding(null);
                }}
                className="flex-1 min-w-0 text-left px-5 py-4 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-ink-black truncate" title={group.url}>
                    {shortUrl(group.url)}
                  </p>
                  <p className="text-caption text-ash-gray mt-1">{group.countLabel}</p>
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-ash-gray mt-0.5 transition-transform duration-150 ${
                    open ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                />
              </button>
              <div className="flex items-center gap-1 pr-4 shrink-0">
                <button
                  type="button"
                  onClick={() => copyText(`page:${group.url}`, groupText(group))}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-caption ${
                    copied === `page:${group.url}`
                      ? "bg-sky-teal/10 text-sky-teal"
                      : "bg-subtle-cream text-ink-black hover:bg-hairline"
                  }`}
                >
                  {copied === `page:${group.url}` ? (
                    <Check className="size-3.5" strokeWidth={1.75} />
                  ) : (
                    <Copy className="size-3.5" strokeWidth={1.75} />
                  )}
                  {copied === `page:${group.url}` ? copy.copied : copy.copy}
                </button>
                <a
                  href={group.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-subtle-cream text-caption text-ink-black hover:bg-hairline"
                >
                  {copy.open}
                  <ExternalLink className="size-3" strokeWidth={1.75} />
                </a>
              </div>
            </div>

            {open && (
              <div className="border-t border-hairline divide-y divide-hairline">
                {group.items.map((f) => {
                  const expanded = openFinding === f.id;
                  const inspect = inspectHint(f.checkKey, lang, f.url);
                  return (
                    <div key={f.id}>
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpenFinding(expanded ? null : f.id)}
                          className="flex-1 min-w-0 text-left px-5 py-3.5 flex items-start gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-block text-caption px-2.5 py-1 rounded-full ${TONE[f.severity] ?? TONE.info}`}
                              >
                                {copy.severity[f.severity] ?? f.severity}
                              </span>
                              <span className="text-caption text-ash-gray uppercase tracking-[0.04em]">
                                {f.category}
                              </span>
                            </div>
                            <p className="text-body-sm font-medium text-ink-black mt-2">{f.message}</p>
                          </div>
                          <ChevronDown
                            className={`size-4 shrink-0 text-ash-gray mt-1 transition-transform duration-150 ${
                              expanded ? "rotate-180" : ""
                            }`}
                            strokeWidth={1.75}
                          />
                        </button>
                        <div className="flex items-center pr-4">
                          <button
                            type="button"
                            onClick={() => copyText(f.id, findingText(f))}
                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-caption shrink-0 ${
                              copied === f.id
                                ? "bg-sky-teal/10 text-sky-teal"
                                : "bg-subtle-cream text-ink-black hover:bg-hairline"
                            }`}
                          >
                            {copied === f.id ? (
                              <Check className="size-3.5" strokeWidth={1.75} />
                            ) : (
                              <Copy className="size-3.5" strokeWidth={1.75} />
                            )}
                            {copied === f.id ? copy.copied : copy.copy}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="px-5 pb-5 space-y-4">
                          {f.detail && (
                            <div>
                              <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                                {copy.seen}
                              </p>
                              <p className="text-body-sm text-ink-black mt-1.5 break-words">{f.detail}</p>
                            </div>
                          )}
                          {f.keywords.length > 0 && (
                            <div>
                              <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                                {copy.keywords}
                              </p>
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {f.keywords.map((k, idx) => (
                                  <li
                                    key={k}
                                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-caption ${
                                      idx === 0
                                        ? "bg-ink-black text-canvas-white"
                                        : "bg-subtle-cream text-ink-black"
                                    }`}
                                  >
                                    {k}
                                    {idx === 0 ? (
                                      <span className="opacity-70">{copy.tryFirst}</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                              <pre className="mt-3 rounded-[16px] bg-subtle-cream px-4 py-3 text-[12px] leading-relaxed text-ink-black whitespace-pre-wrap">
                                <span className="block text-caption text-ash-gray uppercase tracking-[0.06em] mb-2">
                                  {copy.aiPaste}
                                </span>
                                {titleRewritePrompt({
                                  lang,
                                  url: f.url,
                                  title: titleFromDetail(f.detail),
                                  keywords: f.keywords,
                                })}
                              </pre>
                            </div>
                          )}
                          {f.fix && (
                            <div>
                              <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                                {copy.howToFix}
                              </p>
                              <p className="text-body-sm text-ink-black mt-1.5 leading-relaxed">{f.fix}</p>
                            </div>
                          )}
                          {inspect && (
                            <div className="rounded-[16px] bg-subtle-cream px-4 py-3">
                              <p className="text-caption text-ash-gray uppercase tracking-[0.06em]">
                                {copy.inspect}
                              </p>
                              <p className="text-caption text-deep-slate mt-1.5">{inspect.hint}</p>
                              <pre className="mt-3 text-[12px] leading-relaxed text-ink-black overflow-x-auto whitespace-pre">
                                {inspect.snippet}
                              </pre>
                              <p className="text-caption text-ash-gray mt-2">
                                {copy.selector}:{" "}
                                <code className="text-ink-black">{inspect.selector}</code>
                              </p>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-button-black text-canvas-white text-caption shadow-button"
                            >
                              {copy.open}
                              <ExternalLink className="size-3" strokeWidth={1.75} />
                            </a>
                            {inspect?.tool && (
                              <a
                                href={inspect.tool.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-subtle-cream text-caption text-ink-black"
                              >
                                {inspect.tool.label}
                                <ExternalLink className="size-3" strokeWidth={1.75} />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
