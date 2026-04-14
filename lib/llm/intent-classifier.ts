import Anthropic from "@anthropic-ai/sdk";

/**
 * Classify a keyword into a 4-stage buyer-journey intent:
 *   1 = problem-unaware ("water coming through ceiling", "AC making weird noise")
 *   2 = problem-aware    ("how to fix a leaking roof", "why is my AC not cooling")
 *   3 = solution-aware   ("plumber vs DIY pipe repair", "how to choose an HVAC company")
 *   4 = ready-to-hire    ("emergency plumber Paris 11", "best HVAC repair near me", "[service] [city]")
 *
 * Stage 4 keywords convert at 5-10x stage 2. Use the result to prioritize tickets.
 *
 * Cheap path first: rule-based detection covers 80% of cases at zero cost. LLM
 * fallback only for ambiguous queries.
 */

const READY_HIRE_TRIGGERS = [
  "near me",
  "près de",
  "proche",
  "best",
  "meilleur",
  "top",
  "emergency",
  "urgence",
  "urgent",
  "24/7",
  "24h",
  "hire",
  "engager",
  "book",
  "réserver",
  "buy",
  "order",
  "commander",
  "acheter",
  "price",
  "tarif",
  "prix",
  "cost",
  "coût",
  "devis",
  "quote",
  "cheap",
  "pas cher",
  "affordable",
];

const SOLUTION_AWARE_TRIGGERS = [
  " vs ",
  " or ",
  " ou ",
  "compar",
  "alternative",
  "review",
  "avis sur",
  "test ",
  "best ",
  "meilleur ",
  "how to choose",
  "comment choisir",
];

const PROBLEM_AWARE_TRIGGERS = [
  "how to",
  "comment ",
  "why ",
  "pourquoi ",
  "what is",
  "qu'est-ce",
  "guide",
  "tutorial",
  "tutoriel",
  "explained",
  "expliqué",
];

/** Synchronous rule-based classifier. Returns null if too ambiguous. */
export function classifyIntentRule(query: string, knownCities: string[] = []): number | null {
  const q = query.toLowerCase().trim();

  // Stage 4: contains a known city OR ready-to-hire trigger
  for (const city of knownCities) {
    if (city && q.includes(city.toLowerCase())) return 4;
  }
  for (const t of READY_HIRE_TRIGGERS) {
    if (q.includes(t)) return 4;
  }

  // Stage 3: comparison / decision phrases
  for (const t of SOLUTION_AWARE_TRIGGERS) {
    if (q.includes(t)) return 3;
  }

  // Stage 2: how/why/what — research phrases
  for (const t of PROBLEM_AWARE_TRIGGERS) {
    if (q.startsWith(t) || q.includes(" " + t)) return 2;
  }

  // Heuristic: very short, generic queries (1-2 words) without modifiers default to stage 3.
  // Longer informational queries tend to be stage 2.
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return 3;

  // Ambiguous — caller may fall back to LLM
  return null;
}

/**
 * LLM fallback for ambiguous keywords. Batches many keywords into one call to keep cost low
 * (~$0.0003 per keyword via Claude Haiku).
 */
export async function classifyIntentLLM(
  queries: string[],
  knownCities: string[] = [],
): Promise<Record<string, number>> {
  if (queries.length === 0) return {};

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const tool: Anthropic.Tool = {
    name: "classify_keywords",
    description: "Classify each keyword into buyer-journey intent stage 1-4.",
    input_schema: {
      type: "object",
      properties: {
        classifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              stage: { type: "integer", minimum: 1, maximum: 4 },
            },
            required: ["keyword", "stage"],
          },
        },
      },
      required: ["classifications"],
    },
  };

  const cityHint = knownCities.length
    ? `\nKnown cities/areas this business serves: ${knownCities.join(", ")}.`
    : "";

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Classify SEO keywords by buyer journey stage:
1 = problem-unaware (symptom only, doesn't know the solution exists yet)
2 = problem-aware (researching how/why, informational)
3 = solution-aware (comparing options, evaluating)
4 = ready-to-hire (high commercial intent: "near me", emergency, city-specific, "best", price queries)

Stage 4 = revenue NOW. Stage 1-2 = traffic for funnel, low immediate revenue.${cityHint}`,
    tools: [tool],
    tool_choice: { type: "tool", name: "classify_keywords" },
    messages: [
      {
        role: "user",
        content: `Classify these keywords:\n${queries.map((q) => `- ${q}`).join("\n")}`,
      },
    ],
  });

  const toolUse = res.content.find((b: any) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return {};
  const out = (toolUse.input as { classifications: Array<{ keyword: string; stage: number }> })
    .classifications;

  const map: Record<string, number> = {};
  for (const c of out) {
    if (c.stage >= 1 && c.stage <= 4) map[c.keyword] = c.stage;
  }
  return map;
}

/** Classify a batch using rules first, LLM only for ambiguous. */
export async function classifyKeywords(
  queries: string[],
  knownCities: string[] = [],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const ambiguous: string[] = [];

  for (const q of queries) {
    const rule = classifyIntentRule(q, knownCities);
    if (rule != null) {
      result[q] = rule;
    } else {
      ambiguous.push(q);
    }
  }

  if (ambiguous.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const llm = await classifyIntentLLM(ambiguous, knownCities);
      Object.assign(result, llm);
    } catch (err) {
      console.warn("[intent-classifier] LLM fallback failed:", err);
      // Default ambiguous to stage 3 so they're at least ranked
      for (const q of ambiguous) {
        if (!(q in result)) result[q] = 3;
      }
    }
  } else {
    for (const q of ambiguous) {
      if (!(q in result)) result[q] = 3;
    }
  }

  return result;
}
