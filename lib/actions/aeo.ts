"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { requireAccountContext } from "@/lib/account-context";
import { getApiKeyStatus } from "@/lib/actions/api-keys";

async function enabledEngines(userId: string): Promise<Array<"perplexity" | "claude" | "openai">> {
  const userKeys = await getApiKeyStatus(userId);
  const list: Array<"perplexity" | "claude" | "openai"> = [];
  if (process.env.PERPLEXITY_API_KEY) list.push("perplexity");
  if (userKeys.anthropic || process.env.ANTHROPIC_API_KEY) list.push("claude");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

export async function runAeoCheck(keywordIds?: string[]) {
  const ctx = await requireAccountContext();
  const engines = await enabledEngines(ctx.ownerId);
  if (engines.length === 0) {
    return { error: "No LLM engine API keys configured. Add at least one of PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY." };
  }

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.aeoCheck,
    reason: "aeo_check",
    metadata: { engines, keywordCount: keywordIds?.length ?? 0 },
  });
  if (!guard.ok) return { error: guard.error };

  const runId = randomUUID();
  await db.insert(schema.llmVisibilityRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
    engines,
  });

  await inngest.send({
    name: "aeo/visibility.check",
    data: {
      userId: ctx.ownerId,
      runId,
      engines,
      keywordIds: keywordIds && keywordIds.length > 0 ? keywordIds : undefined,
    },
  });

  revalidatePath("/dashboard/aeo");
  return { runId };
}
