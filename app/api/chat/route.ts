import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { CHAT_TOOLS, executeTool } from "@/lib/chat/tools";
import { getUserPlan } from "@/lib/billing-helpers";
import { CHAT_LIMITS, CREDIT_COSTS } from "@/lib/billing-constants";
import { debitCredits, InsufficientCreditsError } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Haiku 4.5 — ~3x cheaper than Sonnet. At ~$0.005/msg it's effectively free
// to bundle into Pro (15€/mo covers thousands of turns before it bites).
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an SEO analyst embedded inside the user's own SEO dashboard. You have direct read access to their data via tools (keywords, positions, GSC metrics, audit findings, cannibalization, AEO visibility, gap scans, briefs, business profile).

Rules:
- NEVER invent data. If you don't have something, call a tool.
- Always prefer tool calls over guessing. It's free; use them liberally.
- When the user asks about a specific keyword, look up its ID with list_keywords first, then fetch history or SERP snapshot.
- Keep answers concrete and numeric. Cite positions, clicks, dates, URLs.
- When you recommend an action, tie it to observed data ("positions on X dropped 4 ranks between Y and Z").
- Respond in the user's language (detect from business profile if you need to — call get_business_profile once per conversation if uncertain).
- Keep final answers tight. Bullet points ok. No preamble ("Sure, let me…").`;

export async function POST(req: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveAccountContext>>;
  try {
    ctx = await resolveAccountContext();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });

  // Quota gate (three buckets):
  //  - Pro within monthly quota → free
  //  - Free within lifetime trial → free
  //  - Otherwise → 1 credit/msg (covers Pro overage + cancelled Pros with credits)
  const plan = await getUserPlan(ctx.ownerId);
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [lifetimeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.userId, ctx.ownerId),
        eq(schema.chatMessages.role, "user"),
      ),
    );
  const lifetimeUsed = lifetimeRow?.count ?? 0;

  const [monthRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.userId, ctx.ownerId),
        eq(schema.chatMessages.role, "user"),
        gte(schema.chatMessages.createdAt, startOfMonth),
      ),
    );
  const monthUsed = monthRow?.count ?? 0;

  const proIncluded = plan === "pro" && monthUsed < CHAT_LIMITS.proMonthlyIncluded;
  const freeTrial = plan === "free" && lifetimeUsed < CHAT_LIMITS.freeLifetimeMessages;

  if (!proIncluded && !freeTrial) {
    try {
      await debitCredits({
        userId: ctx.ownerId,
        amount: CREDIT_COSTS.chatMessageOverage,
        reason: "chat_overage",
        metadata: { monthUsed, lifetimeUsed, plan },
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        const msg =
          plan === "free"
            ? `You've used your ${CHAT_LIMITS.freeLifetimeMessages} free trial messages and have no credits. Subscribe to Pro for ${CHAT_LIMITS.proMonthlyIncluded}/month included.`
            : `Monthly quota reached (${CHAT_LIMITS.proMonthlyIncluded}) and no credits left. Buy a pack on /dashboard/billing.`;
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
      throw e;
    }
  }

  const { conversationId: inputConvId, message } = (await req.json()) as {
    conversationId?: string;
    message: string;
  };
  if (!message?.trim()) return new Response("empty message", { status: 400 });

  // Resolve / create conversation.
  let conversationId = inputConvId ?? null;
  if (conversationId) {
    const [c] = await db
      .select()
      .from(schema.chatConversations)
      .where(
        and(
          eq(schema.chatConversations.id, conversationId),
          eq(schema.chatConversations.userId, ctx.ownerId),
        ),
      )
      .limit(1);
    if (!c) conversationId = null;
  }
  if (!conversationId) {
    conversationId = randomUUID();
    await db.insert(schema.chatConversations).values({
      id: conversationId,
      userId: ctx.ownerId,
      title: message.slice(0, 80),
    });
  }

  // Persist user message.
  await db.insert(schema.chatMessages).values({
    id: randomUUID(),
    conversationId,
    userId: ctx.ownerId,
    role: "user",
    content: message,
  });

  // Load prior messages for context (last 20 turns).
  const prior = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.conversationId, conversationId))
    .orderBy(schema.chatMessages.createdAt);

  // Build Anthropic messages — each chat_messages row becomes a Claude turn.
  // For assistant rows with tool calls we reconstruct a structured assistant turn.
  type Msg = Anthropic.MessageParam;
  const messages: Msg[] = [];
  for (const row of prior) {
    if (row.role === "user") {
      messages.push({ role: "user", content: row.content });
    } else if (row.role === "assistant") {
      messages.push({ role: "assistant", content: row.content });
    }
  }
  // The current user turn is already persisted above, so it's in `prior`.

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send("meta", { conversationId });

        const client = new Anthropic({ apiKey });
        const toolCallsTrace: Array<{
          name: string;
          input: Record<string, unknown>;
          output: unknown;
        }> = [];

        let finalText = "";
        let totalInput = 0;
        let totalOutput = 0;

        // Tool loop — up to 6 rounds of tool calls before we force Claude to answer.
        const MAX_ROUNDS = 6;
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await client.messages.create({
            model: MODEL,
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            tools: CHAT_TOOLS,
            messages,
          });
          totalInput += res.usage.input_tokens;
          totalOutput += res.usage.output_tokens;

          // Collect text parts.
          const textParts: string[] = [];
          const toolUses: Array<{ id: string; name: string; input: Record<string, any> }> = [];
          for (const block of res.content) {
            if (block.type === "text") textParts.push(block.text);
            if (block.type === "tool_use") {
              toolUses.push({
                id: block.id,
                name: block.name,
                input: (block.input as Record<string, any>) ?? {},
              });
            }
          }

          // If no tool uses, this is the final answer.
          if (toolUses.length === 0 || res.stop_reason === "end_turn") {
            finalText = textParts.join("\n\n");
            send("text", finalText);
            break;
          }

          // Otherwise announce each tool call and execute them.
          messages.push({ role: "assistant", content: res.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const use of toolUses) {
            send("tool_call", { name: use.name, input: use.input });
            const output = await executeTool(ctx.ownerId, use.name, use.input);
            toolCallsTrace.push({ name: use.name, input: use.input, output });
            send("tool_result", { name: use.name });
            toolResults.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: JSON.stringify(output).slice(0, 30000), // cap at 30KB per tool result
            });
          }

          messages.push({ role: "user", content: toolResults });
          // Loop — Claude will see the tool results and either answer or call more tools.
        }

        if (!finalText) {
          finalText = "I couldn't finish the reasoning within 6 tool rounds. Try a tighter question.";
          send("text", finalText);
        }

        // Cost: Haiku 4.5 = $1/M input + $5/M output.
        const costUsd = totalInput * (1 / 1_000_000) + totalOutput * (5 / 1_000_000);

        // Persist assistant message.
        await db.insert(schema.chatMessages).values({
          id: randomUUID(),
          conversationId: conversationId!,
          userId: ctx.ownerId,
          role: "assistant",
          content: finalText,
          toolCalls: toolCallsTrace,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          costUsd: costUsd.toFixed(6),
        });

        await db
          .update(schema.chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(schema.chatConversations.id, conversationId!));

        send("done", { costUsd: costUsd.toFixed(6) });
        controller.close();
      } catch (err: any) {
        const msg = String(err?.message ?? err).slice(0, 500);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
