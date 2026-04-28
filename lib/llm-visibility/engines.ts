// AEO / LLM visibility — engine adapters.
//
// Each engine takes a query + user's domain, asks the LLM the question a user
// would ask, and returns the citations. We then check whether the user's
// domain appears in those citations (and at what position), and track which
// competing domains were cited instead.

import { getAnthropicApiKey } from "@/lib/ai-provider";

export type EngineName = "perplexity" | "claude" | "openai";

export type EngineResult = {
  engine: EngineName;
  mentioned: boolean;
  position: number | null; // 1-indexed rank in cited list, null if not cited
  citedUrls: Array<{ url: string; title?: string; domain: string }>;
  competitorMentions: Array<{ domain: string; position: number }>;
  answerSnippet: string;
  costUsd: number;
  error?: string;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function matchesDomain(citationDomain: string, userDomain: string): boolean {
  const c = citationDomain.replace(/^www\./, "").toLowerCase();
  const u = userDomain.replace(/^www\./, "").replace(/^https?:\/\//, "").toLowerCase();
  return c === u || c.endsWith("." + u);
}

function buildPrompt(query: string): string {
  // Neutral phrasing — we want the LLM to answer the query as a real user would
  // ask it, NOT to "find sources for X". The framing matters: if we bias the
  // prompt toward research mode we over-return citations.
  return `${query}\n\nPlease cite your sources.`;
}

// ---------------------------------------------------------------------------
// Perplexity — cleanest API. Returns `citations: string[]` natively.
// Pricing: sonar ~$1/1M input + $1/1M output tokens.
// ---------------------------------------------------------------------------
export async function checkPerplexity(
  query: string,
  userDomain: string,
): Promise<EngineResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return emptyResult("perplexity", "PERPLEXITY_API_KEY not set");
  }

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: buildPrompt(query) }],
        return_citations: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return emptyResult("perplexity", `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data.citations ?? [];
    const usage = data.usage ?? {};
    const costUsd =
      ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)) * (1 / 1_000_000);

    return buildResult("perplexity", answer, citations, userDomain, costUsd);
  } catch (err) {
    return emptyResult("perplexity", err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// Claude — uses built-in web_search tool. Returns citations in content blocks.
// Pricing: sonnet ~$3/1M input + $15/1M output.
// ---------------------------------------------------------------------------
export async function checkClaude(
  query: string,
  userDomain: string,
  userId?: string,
): Promise<EngineResult> {
  const apiKey = userId
    ? await getAnthropicApiKey(userId)
    : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return emptyResult("claude", "ANTHROPIC_API_KEY not set");
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildPrompt(query) }],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return emptyResult("claude", `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();

    // Extract answer text + citation URLs from content blocks.
    const textParts: string[] = [];
    const citationUrls: string[] = [];
    for (const block of data.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
        // Claude attaches `citations` array on text blocks when it cites sources.
        for (const cit of block.citations ?? []) {
          if (cit.url) citationUrls.push(cit.url);
        }
      }
    }
    const answer = textParts.join("\n");

    const usage = data.usage ?? {};
    const costUsd =
      (usage.input_tokens ?? 0) * (3 / 1_000_000) +
      (usage.output_tokens ?? 0) * (15 / 1_000_000);

    return buildResult("claude", answer, citationUrls, userDomain, costUsd);
  } catch (err) {
    return emptyResult("claude", err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// OpenAI — Responses API with web_search tool. GPT-4o-mini keeps cost low.
// Pricing: 4o-mini ~$0.15/1M input + $0.60/1M output + web_search ~$30/1k calls.
// ---------------------------------------------------------------------------
export async function checkOpenAI(
  query: string,
  userDomain: string,
): Promise<EngineResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return emptyResult("openai", "OPENAI_API_KEY not set");
  }

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: buildPrompt(query),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return emptyResult("openai", `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();

    // Parse output blocks. `output` is an array; text blocks carry annotations
    // of type "url_citation" pointing at the URLs the model cited.
    const textParts: string[] = [];
    const citationUrls: string[] = [];
    for (const out of data.output ?? []) {
      if (out.type === "message" && Array.isArray(out.content)) {
        for (const c of out.content) {
          if (c.type === "output_text" && typeof c.text === "string") {
            textParts.push(c.text);
            for (const ann of c.annotations ?? []) {
              if (ann.type === "url_citation" && ann.url) citationUrls.push(ann.url);
            }
          }
        }
      }
    }
    const answer = textParts.join("\n");

    const usage = data.usage ?? {};
    const costUsd =
      (usage.input_tokens ?? 0) * (0.15 / 1_000_000) +
      (usage.output_tokens ?? 0) * (0.6 / 1_000_000) +
      0.03; // rough flat estimate for one web_search_preview call

    return buildResult("openai", answer, citationUrls, userDomain, costUsd);
  } catch (err) {
    return emptyResult("openai", err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------

function buildResult(
  engine: EngineName,
  answer: string,
  citationUrls: string[],
  userDomain: string,
  costUsd: number,
): EngineResult {
  // Dedupe citations in order (keep first occurrence).
  const seen = new Set<string>();
  const citedUrls: EngineResult["citedUrls"] = [];
  for (const url of citationUrls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    citedUrls.push({ url, domain: domainOf(url) });
  }

  let position: number | null = null;
  const competitorMentions: EngineResult["competitorMentions"] = [];
  const seenDomains = new Set<string>();
  citedUrls.forEach((c, idx) => {
    if (seenDomains.has(c.domain)) return;
    seenDomains.add(c.domain);
    const rank = idx + 1;
    if (matchesDomain(c.domain, userDomain)) {
      if (position === null) position = rank;
    } else {
      competitorMentions.push({ domain: c.domain, position: rank });
    }
  });

  return {
    engine,
    mentioned: position !== null,
    position,
    citedUrls,
    competitorMentions,
    answerSnippet: answer.slice(0, 500),
    costUsd,
  };
}

function emptyResult(engine: EngineName, error: string): EngineResult {
  return {
    engine,
    mentioned: false,
    position: null,
    citedUrls: [],
    competitorMentions: [],
    answerSnippet: "",
    costUsd: 0,
    error,
  };
}

export async function checkAllEngines(
  query: string,
  userDomain: string,
  engines: EngineName[],
  userId?: string,
): Promise<EngineResult[]> {
  const tasks = engines.map((e) => {
    if (e === "perplexity") return checkPerplexity(query, userDomain);
    if (e === "claude") return checkClaude(query, userDomain, userId);
    if (e === "openai") return checkOpenAI(query, userDomain);
    return Promise.resolve(emptyResult(e, "unknown engine"));
  });
  return Promise.all(tasks);
}
