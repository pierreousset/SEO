import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { BusinessProfile } from "@/lib/llm/brief";
import { getAnthropicApiKey } from "@/lib/ai-provider";

const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        keyword: z.string().min(2).max(120),
        reason: z.string().min(10).max(300),
        intent_stage: z.number().int().min(1).max(4),
        topical_cluster: z.string().min(2).max(80),
      }),
    )
    .min(1)
    .max(40),
});

export type KeywordSuggestion = z.infer<typeof suggestionSchema>["suggestions"][number];

const MODEL = "claude-sonnet-4-6";

function buildSystem(profile: BusinessProfile | null): string {
  const base = `You are a senior SEO strategist generating NEW keyword ideas a business should target.

Your job (call save_suggestions tool with 20-30 candidates):
- keyword: the exact search query a real user would type (lowercase, natural)
- reason: 1-2 sentences — why this keyword matters for this business
- intent_stage: 1 (problem-unaware), 2 (problem-aware), 3 (solution-aware), 4 (ready-to-hire)
- topical_cluster: a short label grouping related keywords (e.g. "Madrid real estate", "NIE forms")

Rules:
- DO NOT repeat keywords already tracked or already in GSC (shown below).
- Mix of intent stages, but weight toward stage 4 (commercial intent) and stage 3.
- Be concrete. No generic "SEO services" type suggestions.
- Use city names from the business context when relevant ("[service] [city]" is the #1 pattern).
- Use the business LANGUAGE (French/English) consistently per keyword.
- Favor longtail over head terms — 3-6 word phrases convert better.
- Include variants: synonyms, question forms ("how to X"), comparison forms ("X vs Y"), commercial forms ("best X in Y", "[service] price").
- Cluster related keywords in the same topical_cluster so the user can build topical authority.`;

  if (!profile) return base + "\n\nWrite in French unless context suggests English.";

  const lines: string[] = ["BUSINESS CONTEXT — generate keywords RELEVANT to this:"];
  if (profile.businessName) lines.push(`- Business: ${profile.businessName}`);
  if (profile.primaryService) lines.push(`- Primary service: ${profile.primaryService}`);
  if (profile.secondaryServices.length)
    lines.push(`- Secondary services: ${profile.secondaryServices.join(", ")}`);
  if (profile.targetCities.length)
    lines.push(`- Target cities/areas: ${profile.targetCities.join(", ")}`);
  if (profile.targetCustomer) lines.push(`- Target customer: ${profile.targetCustomer}`);
  if (profile.competitorUrls.length)
    lines.push(`- Known competitors (study their angles): ${profile.competitorUrls.join(", ")}`);
  if (profile.biggestSeoProblem)
    lines.push(`- Stated problem: ${profile.biggestSeoProblem}`);
  lines.push(`- Output language: ${profile.preferredLanguage === "en" ? "English" : "French"}`);

  return base + "\n\n" + lines.join("\n");
}

export async function generateKeywordSuggestions(input: {
  profile: BusinessProfile | null;
  existingKeywords: string[];
  gscTopQueries?: string[]; // already seen in GSC, should not be suggested again
  userId?: string;
}): Promise<KeywordSuggestion[]> {
  const apiKey = input.userId
    ? await getAnthropicApiKey(input.userId)
    : process.env.ANTHROPIC_API_KEY;
  const client = new Anthropic({ apiKey });

  const tool: Anthropic.Tool = {
    name: "save_suggestions",
    description: "Save keyword suggestions the business should target.",
    input_schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              reason: { type: "string" },
              intent_stage: { type: "integer", minimum: 1, maximum: 4 },
              topical_cluster: { type: "string" },
            },
            required: ["keyword", "reason", "intent_stage", "topical_cluster"],
          },
          minItems: 20,
          maxItems: 35,
        },
      },
      required: ["suggestions"],
    },
  };

  const userPrompt = `Already tracked (do not repeat): ${input.existingKeywords.slice(0, 100).join(", ") || "(none)"}

Already seen in Google Search Console top 100 queries (do not repeat): ${(input.gscTopQueries ?? []).slice(0, 100).join(", ") || "(none)"}

Generate 20-30 NEW keyword candidates. Prioritize commercial intent (stage 3-4). Cluster by topic.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystem(input.profile),
    tools: [tool],
    tool_choice: { type: "tool", name: "save_suggestions" },
    messages: [{ role: "user", content: userPrompt }],
  });

  if (res.stop_reason === "max_tokens") {
    throw new Error("LLM hit max_tokens — retry with fewer seed keywords");
  }

  const toolUse = res.content.find((b: any) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not return tool_use");
  }

  return suggestionSchema.parse(toolUse.input).suggestions;
}
