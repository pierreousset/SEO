"use server";

import Anthropic from "@anthropic-ai/sdk";
import { and, eq, desc, or, lt, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { getAnthropicApiKey } from "@/lib/ai-provider";

export type MetaSuggestion = {
  title: string;
  metaDescription: string;
  reasoning: string;
};

export type MetaSuggestionResult =
  | { ok: true; suggestion: MetaSuggestion }
  | { ok: false; error: string };

export type BulkMetaSuggestionResult =
  | { ok: true; suggestions: Array<{ url: string } & MetaSuggestion> }
  | { ok: false; error: string };

const MODEL = "claude-haiku-4-5-20250414";

const SYSTEM_PROMPT = `You are an SEO expert. Given a page URL, current title, current H1, word count, and the user's tracked keywords, suggest an optimized title tag (30-60 chars) and meta description (120-160 chars).
The title should include the primary keyword naturally.
The meta description should be a compelling call to action.
Return valid JSON only: { "title": string, "metaDescription": string, "reasoning": string }
No markdown code fences. Just raw JSON.`;

function buildUserPrompt(page: {
  url: string;
  title: string | null;
  h1: string | null;
  wordCount: number | null;
}, trackedKeywords: string[]): string {
  return `Page URL: ${page.url}
Current title: ${page.title || "(missing)"}
Current H1: ${page.h1 || "(missing)"}
Word count: ${page.wordCount ?? "unknown"}

User's tracked keywords: ${trackedKeywords.length > 0 ? trackedKeywords.join(", ") : "(none)"}

Generate an optimized title tag and meta description.`;
}

async function callClaude(
  apiKey: string,
  page: { url: string; title: string | null; h1: string | null; wordCount: number | null },
  trackedKeywords: string[],
): Promise<MetaSuggestion> {
  const client = new Anthropic({ apiKey });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(page, trackedKeywords) }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { title: "", metaDescription: "", reasoning: "AI returned invalid response. Try again." };
  }
  return {
    title: String(parsed.title ?? ""),
    metaDescription: String(parsed.metaDescription ?? ""),
    reasoning: String(parsed.reasoning ?? ""),
  };
}

export async function suggestMetaForPage(url: string): Promise<MetaSuggestionResult> {
  const ctx = await requireAccountContext();

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.metaSuggestion,
    reason: "meta_suggestion",
    metadata: { url },
    aiProvider: "anthropic",
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  // Load the page from the latest crawl run
  const [latestRun] = await db
    .select()
    .from(schema.metaCrawlRuns)
    .where(and(eq(schema.metaCrawlRuns.userId, ctx.ownerId), eq(schema.metaCrawlRuns.status, "done")))
    .orderBy(desc(schema.metaCrawlRuns.queuedAt))
    .limit(1);

  if (!latestRun) return { ok: false, error: "No completed crawl found. Run a site crawl first." };

  // GSC and the crawler store URLs that almost match — slash, www, http/https, case can
  // all differ. Try the exact match first, then fall back to a normalized comparison
  // across the whole run.
  const normalize = (u: string): string => {
    try {
      const p = new URL(u);
      const host = p.hostname.replace(/^www\./, "").toLowerCase();
      const path = p.pathname.replace(/\/+$/, "") || "/";
      return `${host}${path}`;
    } catch {
      return u.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
    }
  };

  type PageRow = { url: string; title: string | null; h1: string | null; wordCount: number | null };
  const exactMatch = await db
    .select({
      url: schema.metaCrawlPages.url,
      title: schema.metaCrawlPages.title,
      h1: schema.metaCrawlPages.h1,
      wordCount: schema.metaCrawlPages.wordCount,
    })
    .from(schema.metaCrawlPages)
    .where(and(eq(schema.metaCrawlPages.runId, latestRun.id), eq(schema.metaCrawlPages.url, url)))
    .limit(1);
  let page: PageRow | undefined = exactMatch[0];

  if (!page) {
    const target = normalize(url);
    const allPages = await db
      .select({
        url: schema.metaCrawlPages.url,
        title: schema.metaCrawlPages.title,
        h1: schema.metaCrawlPages.h1,
        wordCount: schema.metaCrawlPages.wordCount,
      })
      .from(schema.metaCrawlPages)
      .where(eq(schema.metaCrawlPages.runId, latestRun.id));
    page = allPages.find((p) => normalize(p.url) === target);
  }

  if (!page) return { ok: false, error: "Page not found in latest crawl. Run a fresh site audit if this URL was added recently." };

  // Load tracked keywords
  const keywords = await db
    .select({ query: schema.keywords.query })
    .from(schema.keywords)
    .where(eq(schema.keywords.userId, ctx.ownerId));

  const trackedKeywords = keywords.map((k) => k.query);

  const apiKey = await getAnthropicApiKey(ctx.ownerId);
  if (!apiKey) return { ok: false, error: "No Anthropic API key configured." };

  try {
    const suggestion = await callClaude(apiKey, page, trackedKeywords);
    return { ok: true, suggestion };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "AI generation failed." };
  }
}

export async function suggestMetaBulk(): Promise<BulkMetaSuggestionResult> {
  const ctx = await requireAccountContext();

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.metaSuggestionBulk,
    reason: "meta_suggestion_bulk",
    aiProvider: "anthropic",
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  // Load latest crawl
  const [latestRun] = await db
    .select()
    .from(schema.metaCrawlRuns)
    .where(and(eq(schema.metaCrawlRuns.userId, ctx.ownerId), eq(schema.metaCrawlRuns.status, "done")))
    .orderBy(desc(schema.metaCrawlRuns.queuedAt))
    .limit(1);

  if (!latestRun) return { ok: false, error: "No completed crawl found. Run a site crawl first." };

  // Pages missing title or with short title (<30 chars)
  const pages = await db
    .select({
      url: schema.metaCrawlPages.url,
      title: schema.metaCrawlPages.title,
      h1: schema.metaCrawlPages.h1,
      wordCount: schema.metaCrawlPages.wordCount,
      titleLength: schema.metaCrawlPages.titleLength,
    })
    .from(schema.metaCrawlPages)
    .where(
      and(
        eq(schema.metaCrawlPages.runId, latestRun.id),
        or(isNull(schema.metaCrawlPages.title), lt(schema.metaCrawlPages.titleLength, 30)),
      ),
    );

  if (pages.length === 0) {
    return { ok: true, suggestions: [] };
  }

  // Load tracked keywords
  const keywords = await db
    .select({ query: schema.keywords.query })
    .from(schema.keywords)
    .where(eq(schema.keywords.userId, ctx.ownerId));

  const trackedKeywords = keywords.map((k) => k.query);

  const apiKey = await getAnthropicApiKey(ctx.ownerId);
  if (!apiKey) return { ok: false, error: "No Anthropic API key configured." };

  // Process pages (cap at 20 to keep costs reasonable)
  const toProcess = pages.slice(0, 20);
  const results: Array<{ url: string } & MetaSuggestion> = [];

  for (const page of toProcess) {
    try {
      const suggestion = await callClaude(apiKey, page, trackedKeywords);
      results.push({ url: page.url, ...suggestion });
    } catch {
      // Skip individual failures in bulk mode
    }
  }

  return { ok: true, suggestions: results };
}
