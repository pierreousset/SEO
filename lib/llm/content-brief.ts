import Anthropic from "@anthropic-ai/sdk";
import type { BusinessProfile } from "@/lib/llm/brief";
import { getAnthropicApiKey } from "@/lib/ai-provider";

/**
 * Content brief generator — one per keyword.
 *
 * Input: keyword + intent stage + current position + top-10 SERP URLs + business context.
 * Output: structured writer brief (outline, entities, meta variants, competitor takeaways).
 *
 * Uses Claude Sonnet with tool_use for structured JSON output (same pattern as weekly brief).
 */

const MODEL = "claude-sonnet-4-6";

export type ContentBriefInput = {
  keyword: string;
  intentStage: number | null; // 1-4
  country: string;
  currentPosition: number | null; // user's current rank
  currentUrl: string | null; // user's URL if ranked
  topSerp: Array<{ position: number; url: string; domain: string }>; // top 10 competitors
  gscMetrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
  } | null;
  profile: BusinessProfile | null;
  userId?: string;
};

export type ContentBrief = {
  targetIntent: string;
  primaryAngle: string;
  wordCountMin: number;
  wordCountMax: number;
  outline: Array<{ h2: string; h3s: string[]; notes: string }>;
  entitiesToCover: string[];
  questionsToAnswer: string[];
  metaTitleVariants: string[];
  metaDescription: string;
  competitorInsights: Array<{
    url: string;
    domain: string;
    position: number;
    strength: "weak" | "medium" | "strong";
    takeaway: string;
  }>;
  internalLinkingHints: string[];
  warnings: string[];
};

function buildSystemPrompt(profile: BusinessProfile | null, lang: string): string {
  const base = `You are an expert SEO content strategist writing a brief for a copywriter who will produce a single page targeting ONE specific keyword.

Your brief must be actionable, specific, and opinionated. No generic "write quality content" advice. Every recommendation must reference the query, the intent, or a specific competitor pattern.

Rules:
- Write ALL natural-language fields in ${lang === "en" ? "English" : "French"}. Keep code/URLs as-is.
- Outline: 4-8 H2 sections, each with 2-4 H3 subsections. H2s should match the progression a reader needs: problem → context → solution → action.
- Word count: aim for 20-30% longer than the average top-3 competitor if that competitor is dominant; shorter if SERP is full of thin pages.
- Meta title: under 60 characters, keyword near the front, value proposition in the back half.
- Meta description: 140-160 characters, include the keyword, end with a concrete action.
- Competitor takeaways: WHY does each top page work? What's the angle they're missing that you should take?
- Entities: name specific concepts, tools, frameworks, products — not generic categories.
- Questions to answer: phrase as the user would search them (PAA-style).`;

  if (!profile) return base;

  const bits: string[] = [];
  if (profile.businessName) bits.push(`Business: ${profile.businessName}.`);
  if (profile.primaryService) bits.push(`Primary service: ${profile.primaryService}.`);
  if (profile.secondaryServices.length) {
    bits.push(`Secondary: ${profile.secondaryServices.join(", ")}.`);
  }
  if (profile.targetCities.length) {
    bits.push(`Target geo: ${profile.targetCities.join(", ")}.`);
  }
  if (profile.targetCustomer) bits.push(`Target customer: ${profile.targetCustomer}.`);
  if (profile.biggestSeoProblem) bits.push(`Current pain: ${profile.biggestSeoProblem}.`);

  return `${base}

Business context (anchor your angle to this — do not write generic advice):
${bits.join(" ")}`;
}

function intentLabel(stage: number | null): string {
  if (stage === 1) return "problem-unaware (educate first)";
  if (stage === 2) return "problem-aware (explain the solution category)";
  if (stage === 3) return "solution-aware (show why your approach wins)";
  if (stage === 4) return "ready-to-hire (direct conversion intent)";
  return "unclassified";
}

export async function generateContentBrief(
  input: ContentBriefInput,
): Promise<{ content: ContentBrief; model: string; costUsd: number }> {
  const apiKey = input.userId
    ? await getAnthropicApiKey(input.userId)
    : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const lang = input.profile?.preferredLanguage ?? "fr";

  const userContext = [
    `Keyword: "${input.keyword}"`,
    `Intent stage: ${input.intentStage ?? "unclassified"} (${intentLabel(input.intentStage)})`,
    `Country: ${input.country}`,
    input.currentPosition !== null
      ? `Your current position: ${input.currentPosition}${input.currentUrl ? ` (${input.currentUrl})` : ""}`
      : `You do not currently rank in the top 100 for this query.`,
    input.gscMetrics
      ? `GSC 28d: ${input.gscMetrics.clicks} clicks, ${input.gscMetrics.impressions} impressions, CTR ${(input.gscMetrics.ctr * 100).toFixed(1)}%, avg pos ${input.gscMetrics.avgPosition.toFixed(1)}.`
      : `No GSC data available for this keyword.`,
    ``,
    `Top SERP (${input.topSerp.length} results):`,
    ...input.topSerp.map((r) => `  #${r.position} — ${r.domain} — ${r.url}`),
  ].join("\n");

  const prompt = `Produce the content brief for the keyword below.

${userContext}

Return a single save_content_brief tool call. No prose.`;

  const tool: Anthropic.Tool = {
    name: "save_content_brief",
    description: "Save the structured content brief for one keyword.",
    input_schema: {
      type: "object",
      properties: {
        targetIntent: {
          type: "string",
          description: "One sentence naming the exact user intent behind this query.",
        },
        primaryAngle: {
          type: "string",
          description:
            "The single differentiating angle the writer should take vs the SERP. One sentence.",
        },
        wordCountMin: { type: "integer", minimum: 300 },
        wordCountMax: { type: "integer", minimum: 400 },
        outline: {
          type: "array",
          minItems: 4,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              h2: { type: "string" },
              h3s: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
              notes: {
                type: "string",
                description: "Writer guidance: what to cover, tone, examples to include.",
              },
            },
            required: ["h2", "h3s", "notes"],
          },
        },
        entitiesToCover: {
          type: "array",
          minItems: 5,
          maxItems: 20,
          items: { type: "string" },
          description: "Specific named entities (concepts, tools, people, methods).",
        },
        questionsToAnswer: {
          type: "array",
          minItems: 4,
          maxItems: 10,
          items: { type: "string" },
          description: "PAA-style questions phrased as users would ask them.",
        },
        metaTitleVariants: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string", maxLength: 70 },
        },
        metaDescription: { type: "string", minLength: 100, maxLength: 170 },
        competitorInsights: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              domain: { type: "string" },
              position: { type: "integer" },
              strength: { type: "string", enum: ["weak", "medium", "strong"] },
              takeaway: {
                type: "string",
                description:
                  "Why this page ranks + what angle/gap you can exploit. 1-2 sentences.",
              },
            },
            required: ["url", "domain", "position", "strength", "takeaway"],
          },
        },
        internalLinkingHints: {
          type: "array",
          maxItems: 6,
          items: { type: "string" },
          description: "Concrete internal linking suggestions tied to the business context.",
        },
        warnings: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Data gaps or risks the writer should know about.",
        },
      },
      required: [
        "targetIntent",
        "primaryAngle",
        "wordCountMin",
        "wordCountMax",
        "outline",
        "entitiesToCover",
        "questionsToAnswer",
        "metaTitleVariants",
        "metaDescription",
        "competitorInsights",
        "internalLinkingHints",
        "warnings",
      ],
    },
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(input.profile, lang),
    tools: [tool],
    tool_choice: { type: "tool", name: "save_content_brief" },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `Content brief truncated at max_tokens (${response.usage.output_tokens}).`,
    );
  }

  const toolUse = response.content.find((b: any) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not return a tool_use block");
  }

  const content = toolUse.input as ContentBrief;
  const costUsd =
    response.usage.input_tokens * (3 / 1_000_000) +
    response.usage.output_tokens * (15 / 1_000_000);

  return { content, model: MODEL, costUsd };
}
