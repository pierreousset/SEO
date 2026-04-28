import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { authenticateApiRequest } from "@/lib/api-auth";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { getAnthropicApiKey } from "@/lib/ai-provider";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

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
    credits: CREDIT_COSTS.schemaGeneration,
    reason: "schema_generation_api",
    metadata: { url },
    aiProvider: "anthropic",
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 402 });
  }

  // Load page meta from latest crawl
  const crawlPages = await db
    .select({
      url: schema.metaCrawlPages.url,
      title: schema.metaCrawlPages.title,
      h1: schema.metaCrawlPages.h1,
    })
    .from(schema.metaCrawlPages)
    .where(
      and(
        eq(schema.metaCrawlPages.userId, userId),
        eq(schema.metaCrawlPages.url, url),
      ),
    )
    .limit(1);

  const page = crawlPages[0];
  const title = page?.title ?? "";
  const h1 = page?.h1 ?? "";

  // Load business profile
  const [profile] = await db
    .select()
    .from(schema.businessProfiles)
    .where(eq(schema.businessProfiles.userId, userId))
    .limit(1);

  const businessName = profile?.businessName ?? "Unknown";
  const primaryService = profile?.primaryService ?? "";
  const targetCities = (profile?.targetCities ?? []).join(", ");

  const apiKey = await getAnthropicApiKey(userId);
  if (!apiKey) {
    return NextResponse.json({ error: "No Anthropic API key configured." }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Generate the most appropriate JSON-LD schema.org markup for this page. Business: ${businessName}, Service: ${primaryService}, Cities: ${targetCities}. Page URL: ${url}, Title: ${title}, H1: ${h1}. Choose the best schema type (LocalBusiness, Article, Service, FAQ, BreadcrumbList, etc.). Return ONLY the JSON-LD script tag content, no explanation.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const jsonLd = textBlock?.text ?? "";

    return NextResponse.json({ jsonLd });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
