import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Finding } from "@/lib/audit/checks";
import type { BusinessProfile } from "@/lib/llm/brief";

const synthesisSchema = z.object({
  summary: z.string().min(20).max(800),
  top_actions: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        action: z.string(),
        target_url: z.string().nullable().default(null),
        why: z.string(),
        estimated_effort_min: z.number().int().positive(),
      }),
    )
    .max(10)
    .default([]),
});

export type AuditSynthesis = z.infer<typeof synthesisSchema> & { model: string };

const MODEL = "claude-sonnet-4-6";

function buildSystem(profile: BusinessProfile | null): string {
  const base = `You are a senior technical SEO consultant reading a freshly-collected on-page audit.

Your job (call save_synthesis tool):
1. summary — 2-3 sentences (max 800 chars) that explain the state of the site, what's the biggest theme.
2. top_actions — 5-8 prioritized actions ranked by impact-to-effort. Each:
   - priority: high (revenue/critical), medium (quality), low (polish)
   - action: specific, imperative ("Add meta description on /about")
   - target_url: the URL it applies to (or null if site-wide)
   - why: 1 sentence linking the action to a real consequence
   - estimated_effort_min: honest minutes estimate

Rules:
- Cite real findings from the data. Never invent issues.
- Group similar findings into one action when possible (e.g. "5 pages missing canonical → add to all in one PR").
- Cite real URLs.
- Reference business context if provided (cities, services).
- "info" severity findings are observations only — never feature them as high-priority actions.
  In particular, "schema_missing" with severity:info means our crawler didn't see schema in the
  raw HTML — but client-side rendered or tag-manager-injected schema is invisible to us.
  Treat schema findings as low priority unless multiple severity:high signals also point to it.`;

  if (!profile) return base + "\n\nWrite in French unless URLs and content suggest English.";

  const lines: string[] = ["BUSINESS CONTEXT (always reference when writing actions):"];
  if (profile.businessName) lines.push(`- Business: ${profile.businessName}`);
  if (profile.primaryService) lines.push(`- Primary service: ${profile.primaryService}`);
  if (profile.targetCities.length) lines.push(`- Target cities: ${profile.targetCities.join(", ")}`);
  if (profile.competitorUrls.length) lines.push(`- Competitors: ${profile.competitorUrls.join(", ")}`);
  if (profile.biggestSeoProblem) lines.push(`- Stated problem: ${profile.biggestSeoProblem}`);
  lines.push(`- Language: write in ${profile.preferredLanguage === "en" ? "English" : "French"}.`);

  return base + "\n\n" + lines.join("\n");
}

export async function synthesizeAudit(input: {
  findings: Finding[];
  profile?: BusinessProfile | null;
  pagesCrawled: number;
}): Promise<AuditSynthesis> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const tool: Anthropic.Tool = {
    name: "save_synthesis",
    description: "Save the AI-prioritized audit synthesis.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        top_actions: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              priority: { type: "string", enum: ["high", "medium", "low"] },
              action: { type: "string" },
              target_url: { type: ["string", "null"] },
              why: { type: "string" },
              estimated_effort_min: { type: "integer", minimum: 1 },
            },
            required: ["priority", "action", "why", "estimated_effort_min"],
          },
        },
      },
      required: ["summary", "top_actions"],
    },
  };

  // Compact findings into a flat structure the LLM can easily reason over.
  const compact = input.findings.map((f) => ({
    url: f.url,
    severity: f.severity,
    category: f.category,
    msg: f.message,
    ...(f.detail ? { detail: f.detail } : {}),
  }));

  const prompt = `Audit results (${input.pagesCrawled} pages crawled, ${input.findings.length} findings):

${JSON.stringify(compact, null, 2)}

Synthesize the most impactful actions. Group similar findings.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystem(input.profile ?? null),
    tools: [tool],
    tool_choice: { type: "tool", name: "save_synthesis" },
    messages: [{ role: "user", content: prompt }],
  });

  if (res.stop_reason === "max_tokens") {
    throw new Error("LLM hit max_tokens — too many findings to summarize");
  }

  const toolUse = res.content.find((b: any) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not return a tool_use block");
  }

  const parsed = synthesisSchema.parse(toolUse.input);
  return { ...parsed, model: MODEL };
}
