import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { computeDiagnostic, diagnosticInfo } from "@/lib/diagnostics";
import { classifyCompetitorUrl } from "@/lib/competitor-threat";

/**
 * Weekly AI brief generator.
 *
 * Input: keywords + their positions for the past week.
 * Output: structured JSON brief with summary, top_movers, actionable tickets, warnings.
 *
 * Uses Claude Sonnet for reasoning, with structured output via tool-use.
 *
 * Eval: prompt changes MUST pass the golden-set eval in tests/eval/brief.test.ts.
 */

const briefSchema = z.object({
  summary: z.string().min(10).max(800),
  top_movers: z
    .array(
      z.object({
        keyword: z.string(),
        delta: z.number(), // positive = improved rank
        probable_cause: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(10)
    .default([]),
  tickets: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        action: z.string(),
        target: z.string(),
        why: z.string(),
        estimated_effort_min: z.number().int().positive(),
      }),
    )
    .max(10)
    .default([]),
  warnings: z.array(z.string()).max(5).default([]),
});

export type Brief = z.infer<typeof briefSchema> & { model: string };
export type BusinessProfile = {
  businessName: string | null;
  primaryService: string | null;
  secondaryServices: string[];
  targetCities: string[];
  targetCustomer: string | null;
  averageCustomerValueEur: number | null;
  competitorUrls: string[];
  biggestSeoProblem: string | null;
  preferredLanguage: string;
};

const MODEL = "claude-sonnet-4-6";

const BASE_SYSTEM_PROMPT = `You are an expert SEO analyst writing a weekly brief for the site owner.

Your job (call save_brief tool with EXACTLY these fields):
1. summary: 1-2 sentences MAX, under 600 characters total. Be punchy.
2. top_movers: 3-5 keywords with the largest position changes. Each needs delta, probable_cause, confidence (0-1).
3. tickets: 3-7 specific actions to execute this week. Each needs priority/action/target/why/estimated_effort_min.
4. warnings: 0-3 short flags about data gaps or anomalies.

CRITICAL: All four fields are REQUIRED. Even if there are no movers (one day of data),
return top_movers: [] and tickets with whatever advice you can give from absolute positions.
Always include warnings (use [] if none).

Rules:
- Only cite real data you see in the input. Never invent positions, URLs, or trends.
- When confidence is low, lower the "confidence" field and phrase recommendations as "hypothèse à valider".
- Tickets must be specific ("update meta description on /pricing") not generic ("improve SEO").
- estimated_effort_min: honest minutes estimate.
- Keep summary SHORT. Detail belongs in tickets, not in summary.
- When the business context lists target cities, secondary services, or competitors, USE them in your recommendations (e.g. "create page for [service] in [city]"). The whole point of having context is to be specific.
- Intent stages on each keyword: 4=ready-to-hire (highest revenue), 3=solution-aware, 2=problem-aware, 1=problem-unaware. Stage 4 keywords convert 5-10x stage 2. Prioritize HIGH-priority tickets on stage 4 movers and on stage 4 keywords stuck in positions 4-15. Stage 1-2 keywords get medium/low priority tickets focused on funnel content.
- When competitor positions are present in the data, USE them. Mention specific competitor domains and positions when relevant (e.g. "competitor1.com is at #3 for 'X', you're at #12 — gap of 9 positions"). When a competitor moved while you didn't (or vice versa), call it out as a probable_cause for top_movers. The user is paying for tracking competitors specifically to get this analysis.
- Each keyword has a "diagnostic" tag explaining its state:
  - gap_zone (rank 5-20) = HIGHEST PRIORITY for tickets. One title/meta polish can land page 1 in 30-60d. These are the fastest-revenue actions.
  - momentum (gained >5 positions) = double down with internal links to that page + fresh related content.
  - lost_ground (dropped >5 positions or fell out of top 100) = urgent investigation. Probable causes: algo update, competitor publishing, on-page change. Always include in tickets.
  - stale (no movement for 14+ days, rank > 20) = needs intervention. Refresh content, add internal links, or recommend pruning.
  - top (rank 1-4) = defended territory. Mention only if competitor is closing in.
  - unranked (never in top 100) = long-term play. Low priority unless this keyword is critical to business context.
  Tickets MUST reference the diagnostic when relevant ("'X' is in gap_zone — rewrite title to include 'Y'").
- Competitor threat tiers (HIGH/MEDIUM/LOW) tell you which battles to fight:
  - LOW threat competitors that beat us = QUICK WINS. Recommend going head-to-head with one focused page (high-priority ticket).
  - MEDIUM threat = beatable in 30-60 days with a sharper angle. Medium-priority ticket.
  - HIGH threat (authority domains like Wikipedia, Ahrefs, big publishers) = DON'T fight head-on. Recommend an alternative angle, longer-tail keyword, or different format. Low-priority or skip entirely.
  Always cite the threat tier when discussing competitor moves.
- When GSC data is available (gsc field on a keyword), USE IT for ROI estimates. Real example to follow: "this keyword has 23 clicks/month at avg position 11; if we go to position 5, expected ~70 clicks/month based on typical CTR curves (pos 5 ≈ 6-9% CTR vs pos 11 ≈ 1-2%)". Cite real numbers from gsc.total_clicks_period, gsc.avg_ctr, gsc.total_impressions_period in tickets when relevant.
- The weak_ctr diagnostic means the page ranks well but title/meta is bad — recommend rewriting both with the actual CTR number cited as evidence.
- The low_authority diagnostic means lots of impressions but rank > 20 — recommend internal links + topical authority page, cite the impressions number to size the opportunity.`;

function buildSystemPrompt(profile: BusinessProfile | null): string {
  if (!profile) return BASE_SYSTEM_PROMPT + `\n\nLanguage: write in French unless keywords clearly indicate English.`;

  const lines: string[] = [];
  lines.push("BUSINESS CONTEXT (always reference this when writing recommendations):");
  if (profile.businessName) lines.push(`- Business: ${profile.businessName}`);
  if (profile.primaryService) lines.push(`- Primary service: ${profile.primaryService}`);
  if (profile.secondaryServices.length) lines.push(`- Secondary services: ${profile.secondaryServices.join(", ")}`);
  if (profile.targetCities.length) lines.push(`- Target cities/areas: ${profile.targetCities.join(", ")}`);
  if (profile.targetCustomer) lines.push(`- Target customer: ${profile.targetCustomer}`);
  if (profile.averageCustomerValueEur) lines.push(`- Average customer value: €${profile.averageCustomerValueEur} (use this to estimate ROI of recommendations)`);
  if (profile.competitorUrls.length) lines.push(`- Known competitors: ${profile.competitorUrls.join(", ")}`);
  if (profile.biggestSeoProblem) lines.push(`- Biggest current SEO problem: ${profile.biggestSeoProblem} (focus tickets here when relevant)`);
  lines.push(`- Write the brief in: ${profile.preferredLanguage === "en" ? "English" : "French"}.`);

  return BASE_SYSTEM_PROMPT + "\n\n" + lines.join("\n");
}

export async function generateBrief(input: {
  keywords: Array<{ id: string; query: string; country: string; intentStage?: number | null }>;
  positions: Array<{ keywordId: string; date: string; position: number | null; url: string | null }>;
  competitorPositions?: Array<{
    keywordId: string;
    competitorDomain: string;
    date: string;
    position: number | null;
    url?: string | null;
  }>;
  /**
   * GSC daily metrics per keyword. Unlocks click/impression/CTR-aware tickets
   * and weak_ctr / low_authority diagnostics. Sourced from gsc_metrics table.
   */
  gscMetrics?: Array<{
    keywordId: string;
    date: string;
    clicks: number;
    impressions: number;
    ctr: number; // 0-1
    gscPosition: number;
  }>;
  periodStart: string;
  periodEnd: string;
  profile?: BusinessProfile | null;
}): Promise<Brief> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Assemble a compact data payload for the model.
  // Intent stage hint: prioritize tickets on stage 4 (high commercial intent) keywords.
  // Diagnostic tag tells the LLM the WHY behind each keyword's state.
  const data = input.keywords.map((k) => {
    const sortedPositions = input.positions
      .filter((p) => p.keywordId === k.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const history = sortedPositions.map((p) => ({ date: p.date, pos: p.position, url: p.url }));

    // GSC stats for this keyword over the brief period
    const kwGsc = (input.gscMetrics ?? [])
      .filter((g) => g.keywordId === k.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const totalClicks = kwGsc.reduce((s, g) => s + g.clicks, 0);
    const totalImpressions = kwGsc.reduce((s, g) => s + g.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      kwGsc.length > 0 ? kwGsc.reduce((s, g) => s + g.gscPosition, 0) / kwGsc.length : null;
    const gscSummary = kwGsc.length > 0
      ? { totalClicks, totalImpressions, avgCtr, avgPosition }
      : null;

    const diagnosticTag = computeDiagnostic(
      sortedPositions.map((p) => ({ date: p.date, position: p.position })),
      gscSummary,
    );

    // Competitor positions for this keyword, sorted by date ascending.
    // Each competitor includes its threat tier so the LLM can prioritize battles.
    const compsForKw = (input.competitorPositions ?? [])
      .filter((c) => c.keywordId === k.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const compHistory: Record<
      string,
      { threat: string; reason: string; history: Array<{ date: string; pos: number | null }> }
    > = {};
    for (const c of compsForKw) {
      if (!compHistory[c.competitorDomain]) {
        const threat = c.url
          ? classifyCompetitorUrl(c.url)
          : { tier: "LOW" as const, reason: "no URL captured" };
        compHistory[c.competitorDomain] = {
          threat: threat.tier,
          reason: threat.reason,
          history: [],
        };
      }
      compHistory[c.competitorDomain].history.push({ date: c.date, pos: c.position });
    }

    return {
      keyword: k.query,
      country: k.country,
      intent_stage: k.intentStage ?? null,
      diagnostic: diagnosticTag,
      diagnostic_hint: diagnosticInfo(diagnosticTag).hint,
      gsc: gscSummary
        ? {
            total_clicks_period: totalClicks,
            total_impressions_period: totalImpressions,
            avg_ctr: Number(avgCtr.toFixed(4)),
            avg_position: avgPosition != null ? Number(avgPosition.toFixed(2)) : null,
            // Recent 14 days for trend visibility
            last_14d: kwGsc
              .slice(-14)
              .map((g) => ({ date: g.date, clicks: g.clicks, impressions: g.impressions, ctr: Number(g.ctr.toFixed(4)), pos: Number(g.gscPosition.toFixed(2)) })),
          }
        : null,
      history,
      competitors: compHistory,
    };
  });

  const prompt = `Period: ${input.periodStart} → ${input.periodEnd}

Keyword data (positions by date, null = out of top 100):
${JSON.stringify(data, null, 2)}

Respond with a JSON object matching this schema exactly:
{
  "summary": "1-2 sentences",
  "top_movers": [{"keyword": "...", "delta": 3, "probable_cause": "...", "confidence": 0.7}],
  "tickets": [{"priority": "high|medium|low", "action": "...", "target": "/...", "why": "...", "estimated_effort_min": 15}],
  "warnings": ["..."]
}`;

  // Tool-use forces Anthropic to return structured JSON matching this schema.
  // No more "extract JSON from text" regex parsing — guaranteed valid output.
  const tool: Anthropic.Tool = {
    name: "save_brief",
    description: "Save the structured weekly SEO brief.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "1-2 sentence summary of the week" },
        top_movers: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              delta: {
                type: "number",
                description: "Position change. Positive = improved (e.g. +3 = went from 8 to 5).",
              },
              probable_cause: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["keyword", "delta", "probable_cause", "confidence"],
          },
        },
        tickets: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              priority: { type: "string", enum: ["high", "medium", "low"] },
              action: { type: "string" },
              target: { type: "string" },
              why: { type: "string" },
              estimated_effort_min: { type: "integer", minimum: 1 },
            },
            required: ["priority", "action", "target", "why", "estimated_effort_min"],
          },
        },
        warnings: { type: "array", maxItems: 5, items: { type: "string" } },
      },
      required: ["summary", "top_movers", "tickets", "warnings"],
    },
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(input.profile ?? null),
    tools: [tool],
    tool_choice: { type: "tool", name: "save_brief" },
    messages: [{ role: "user", content: prompt }],
  });

  // Detect truncation: if Claude hit max_tokens, the tool call may be incomplete.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `LLM truncated at max_tokens (${response.usage.output_tokens}). Increase max_tokens or shorten the prompt data.`,
    );
  }

  const toolUse = response.content.find((b: any) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not return a tool_use block");
  }

  const parsed = briefSchema.parse(toolUse.input);
  return { ...parsed, model: MODEL };
}
