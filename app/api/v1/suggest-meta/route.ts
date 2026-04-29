import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { authenticateApiRequest } from "@/lib/api-auth";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { getAnthropicApiKey } from "@/lib/ai-provider";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-4-5-20250414";

const SYSTEM_PROMPT = `You are an SEO expert. Given a page URL, current title, current H1, word count, and the user's tracked keywords, suggest an optimized title tag (30-60 chars) and meta description (120-160 chars).
The title should include the primary keyword naturally.
The meta description should be a compelling call to action.
Return valid JSON only: { "title": string, "metaDescription": string, "reasoning": string }
No markdown code fences. Just raw JSON.`;

export async function POST(req: Request) {
  const userId = await authenticateApiRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Missing required field: url" }, { status: 400 });
  }

  const guard = await guardMeteredAction({
    userId,
    credits: CREDIT_COSTS.metaSuggestion,
    reason: "meta_suggestion_api",
    metadata: { url },
    aiProvider: "anthropic",
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 402 });
  }

  // Load the page from the latest crawl run
  const [latestRun] = await db
    .select()
    .from(schema.metaCrawlRuns)
    .where(and(eq(schema.metaCrawlRuns.userId, userId), eq(schema.metaCrawlRuns.status, "done")))
    .orderBy(desc(schema.metaCrawlRuns.queuedAt))
    .limit(1);

  if (!latestRun) {
    return NextResponse.json({ error: "No completed crawl found. Run a site crawl first." }, { status: 404 });
  }

  // GSC URLs and crawler URLs sometimes differ on trailing slash / www / case.
  // Try exact match first, then fall back to a normalized compare across the run.
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

  if (!page) {
    return NextResponse.json({ error: "Page not found in latest crawl. Run a fresh site audit if this URL was added recently." }, { status: 404 });
  }

  // Load tracked keywords
  const keywords = await db
    .select({ query: schema.keywords.query })
    .from(schema.keywords)
    .where(eq(schema.keywords.userId, userId));

  const trackedKeywords = keywords.map((k) => k.query);

  const apiKey = await getAnthropicApiKey(userId);
  if (!apiKey) {
    return NextResponse.json({ error: "No Anthropic API key configured." }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Page URL: ${page.url}\nCurrent title: ${page.title || "(missing)"}\nCurrent H1: ${page.h1 || "(missing)"}\nWord count: ${page.wordCount ?? "unknown"}\n\nUser's tracked keywords: ${trackedKeywords.length > 0 ? trackedKeywords.join(", ") : "(none)"}\n\nGenerate an optimized title tag and meta description.`,
        },
      ],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { title: "", metaDescription: "", reasoning: "AI returned invalid response. Try again." },
      );
    }

    return NextResponse.json({
      title: String(parsed.title ?? ""),
      metaDescription: String(parsed.metaDescription ?? ""),
      reasoning: String(parsed.reasoning ?? ""),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
