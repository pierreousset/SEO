/**
 * Chat tools — Claude tool_use definitions + server-side executors.
 *
 * Each tool: (a) schema Claude sees, (b) executor that runs on our server with
 * the tenant-scoped DB. Executors MUST use tenantDb(userId) to enforce isolation.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { db, tenantDb, schema } from "@/db/client";
import { and, eq, desc, gte } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Tool schemas (what Claude sees)
// ---------------------------------------------------------------------------

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_keywords",
    description:
      "List the user's tracked keywords with latest position. Filter by country or minimum/maximum position. Returns at most 50 rows.",
    input_schema: {
      type: "object",
      properties: {
        country: {
          type: "string",
          description: "2-letter country code lowercase, e.g. 'fr' or 'us'.",
        },
        minPosition: { type: "integer", description: "Minimum current rank (inclusive)." },
        maxPosition: { type: "integer", description: "Maximum current rank (inclusive)." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
      },
    },
  },
  {
    name: "keyword_history",
    description:
      "Time series of a single keyword: daily positions + GSC clicks/impressions over the last N days (default 28, max 90).",
    input_schema: {
      type: "object",
      properties: {
        keywordId: { type: "string" },
        days: { type: "integer", minimum: 3, maximum: 90 },
      },
      required: ["keywordId"],
    },
  },
  {
    name: "get_serp_snapshot",
    description:
      "Latest top-10 SERP snapshot for a tracked keyword (competitor domains and positions).",
    input_schema: {
      type: "object",
      properties: {
        keywordId: { type: "string" },
      },
      required: ["keywordId"],
    },
  },
  {
    name: "get_latest_audit",
    description:
      "Latest site audit result: high-severity findings + AI synthesis. Use for questions about technical SEO problems.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_latest_cannibalization",
    description:
      "Latest cannibalization scan findings: queries where multiple user URLs compete against each other.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_aeo_results",
    description:
      "Latest AEO (LLM visibility) check results: whether the user's domain is cited by ChatGPT / Perplexity / Claude for their keywords.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_competitor_gap",
    description:
      "Latest competitor keyword-gap scan: top opportunity keywords competitors rank for and the user doesn't track.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 30 },
      },
    },
  },
  {
    name: "get_business_profile",
    description: "The user's declared business profile (services, geo, competitors, language).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "latest_brief",
    description: "Return the most recent weekly AI brief: summary, top_movers, tickets.",
    input_schema: { type: "object", properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

export async function executeTool(
  userId: string,
  name: string,
  input: Record<string, any>,
): Promise<unknown> {
  const t = tenantDb(userId);

  switch (name) {
    case "list_keywords":
      return execListKeywords(userId, input);
    case "keyword_history":
      if (!input.keywordId) return { error: "keywordId required" };
      return execKeywordHistory(userId, { keywordId: input.keywordId, days: input.days });
    case "get_serp_snapshot":
      if (!input.keywordId) return { error: "keywordId required" };
      return execGetSerpSnapshot(userId, { keywordId: input.keywordId });
    case "get_latest_audit":
      return execGetLatestAudit(userId);
    case "get_latest_cannibalization":
      return execGetCannibalization(userId);
    case "get_aeo_results":
      return execGetAeoResults(userId);
    case "get_competitor_gap":
      return execGetCompetitorGap(userId, input);
    case "get_business_profile":
      return t.selectBusinessProfile();
    case "latest_brief":
      return execLatestBrief(userId);
    default:
      return { error: `unknown tool ${name}` };
  }
}

async function execListKeywords(
  userId: string,
  input: { country?: string; minPosition?: number; maxPosition?: number; limit?: number },
) {
  const limit = Math.min(input.limit ?? 20, 50);
  const t = tenantDb(userId);
  const keywords = (await t.selectKeywords()).filter((k) => !k.removedAt);

  // Grab latest position per keyword — one query, then group in memory.
  const latestPositions = await db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.userId, userId))
    .orderBy(desc(schema.positions.date))
    .limit(2000);

  const latestByKeyword = new Map<string, (typeof latestPositions)[number]>();
  for (const p of latestPositions) {
    if (!latestByKeyword.has(p.keywordId)) latestByKeyword.set(p.keywordId, p);
  }

  const rows = keywords
    .map((k) => {
      const pos = latestByKeyword.get(k.id) ?? null;
      return {
        id: k.id,
        query: k.query,
        country: k.country,
        intentStage: k.intentStage,
        position: pos?.position ?? null,
        url: pos?.url ?? null,
        date: pos?.date ?? null,
      };
    })
    .filter((r) => {
      if (input.country && r.country !== input.country) return false;
      if (input.minPosition != null && (r.position ?? 0) < input.minPosition) return false;
      if (input.maxPosition != null && (r.position ?? 999) > input.maxPosition) return false;
      return true;
    });

  rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  return { count: rows.length, keywords: rows.slice(0, limit) };
}

async function execKeywordHistory(
  userId: string,
  input: { keywordId: string; days?: number },
) {
  const days = Math.min(input.days ?? 28, 90);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const [kw] = await db
    .select()
    .from(schema.keywords)
    .where(and(eq(schema.keywords.id, input.keywordId), eq(schema.keywords.userId, userId)))
    .limit(1);
  if (!kw) return { error: "keyword not found" };

  const positions = await db
    .select()
    .from(schema.positions)
    .where(
      and(
        eq(schema.positions.keywordId, input.keywordId),
        eq(schema.positions.userId, userId),
        gte(schema.positions.date, cutoffStr),
      ),
    )
    .orderBy(schema.positions.date);

  const gsc = await db
    .select()
    .from(schema.gscMetrics)
    .where(
      and(
        eq(schema.gscMetrics.keywordId, input.keywordId),
        eq(schema.gscMetrics.userId, userId),
        gte(schema.gscMetrics.date, cutoffStr),
      ),
    )
    .orderBy(schema.gscMetrics.date);

  return {
    keyword: kw.query,
    intentStage: kw.intentStage,
    positions: positions.map((p) => ({
      date: p.date,
      position: p.position,
      url: p.url,
    })),
    gsc: gsc.map((g) => ({
      date: g.date,
      clicks: g.clicks,
      impressions: g.impressions,
      ctr: Number(g.ctr),
      gscPosition: Number(g.gscPosition),
    })),
  };
}

async function execGetSerpSnapshot(
  userId: string,
  input: { keywordId: string },
) {
  const [latest] = await db
    .select()
    .from(schema.positions)
    .where(
      and(
        eq(schema.positions.keywordId, input.keywordId),
        eq(schema.positions.userId, userId),
      ),
    )
    .orderBy(desc(schema.positions.date))
    .limit(1);
  if (!latest) return { error: "no SERP data" };

  const snapshot = await db
    .select()
    .from(schema.competitorPositions)
    .where(
      and(
        eq(schema.competitorPositions.keywordId, input.keywordId),
        eq(schema.competitorPositions.userId, userId),
        eq(schema.competitorPositions.date, latest.date),
      ),
    )
    .orderBy(schema.competitorPositions.position)
    .limit(10);

  return {
    date: latest.date,
    userPosition: latest.position,
    userUrl: latest.url,
    top10: snapshot.map((s) => ({
      position: s.position,
      domain: s.competitorDomain,
      url: s.url,
    })),
  };
}

async function execGetLatestAudit(userId: string) {
  const [run] = await db
    .select()
    .from(schema.auditRuns)
    .where(eq(schema.auditRuns.userId, userId))
    .orderBy(desc(schema.auditRuns.queuedAt))
    .limit(1);
  if (!run || run.status !== "done") return { error: "no completed audit" };

  const highFindings = await db
    .select()
    .from(schema.auditFindings)
    .where(
      and(
        eq(schema.auditFindings.runId, run.id),
        eq(schema.auditFindings.severity, "high"),
      ),
    )
    .limit(20);

  let synthesis: unknown = null;
  if (run.aiSummary) {
    try {
      synthesis = JSON.parse(run.aiSummary);
    } catch {}
  }

  return {
    finishedAt: run.finishedAt,
    pagesCrawled: run.pagesCrawled,
    findingsCount: run.findingsCount,
    highSeverityCount: run.highSeverityCount,
    highFindings: highFindings.map((f) => ({
      url: f.url,
      category: f.category,
      message: f.message,
      fix: f.fix,
    })),
    synthesis,
  };
}

async function execGetCannibalization(userId: string) {
  const [run] = await db
    .select()
    .from(schema.cannibalizationRuns)
    .where(eq(schema.cannibalizationRuns.userId, userId))
    .orderBy(desc(schema.cannibalizationRuns.queuedAt))
    .limit(1);
  if (!run || run.status !== "done") return { error: "no completed cannibalization scan" };
  return {
    finishedAt: run.finishedAt,
    findingsCount: run.findingsCount,
    findings: run.findings,
  };
}

async function execGetAeoResults(userId: string) {
  const [run] = await db
    .select()
    .from(schema.llmVisibilityRuns)
    .where(eq(schema.llmVisibilityRuns.userId, userId))
    .orderBy(desc(schema.llmVisibilityRuns.queuedAt))
    .limit(1);
  if (!run || run.status !== "done") return { error: "no completed AEO check" };

  const results = await db
    .select()
    .from(schema.llmVisibilityResults)
    .where(eq(schema.llmVisibilityResults.runId, run.id));

  return {
    finishedAt: run.finishedAt,
    engines: run.engines,
    mentioned: run.mentionedCount,
    total: run.checkCount,
    byKeyword: results.map((r) => ({
      keywordId: r.keywordId,
      engine: r.engine,
      mentioned: r.mentioned,
      position: r.position,
      answerSnippet: r.answerSnippet,
    })),
  };
}

async function execGetCompetitorGap(userId: string, input: { limit?: number }) {
  const limit = Math.min(input.limit ?? 20, 30);
  const [run] = await db
    .select()
    .from(schema.competitorGapRuns)
    .where(eq(schema.competitorGapRuns.userId, userId))
    .orderBy(desc(schema.competitorGapRuns.queuedAt))
    .limit(1);
  if (!run || run.status !== "done") return { error: "no completed gap scan" };

  const findings = (run.findings ?? []).slice(0, limit);
  return {
    finishedAt: run.finishedAt,
    totalGaps: run.gapsFound,
    findings,
  };
}

async function execLatestBrief(userId: string) {
  const [brief] = await db
    .select()
    .from(schema.briefs)
    .where(eq(schema.briefs.userId, userId))
    .orderBy(desc(schema.briefs.periodStart))
    .limit(1);
  if (!brief) return { error: "no brief yet" };
  return {
    periodStart: brief.periodStart,
    periodEnd: brief.periodEnd,
    summary: brief.summary,
    topMovers: brief.topMovers,
    tickets: brief.tickets,
    warnings: brief.warnings,
  };
}
