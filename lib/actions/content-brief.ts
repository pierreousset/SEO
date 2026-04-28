"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { requireAccountContext } from "@/lib/account-context";

export async function triggerContentBrief(keywordId: string) {
  const ctx = await requireAccountContext();

  // Guard: the keyword must belong to this user.
  const [kw] = await db
    .select({ id: schema.keywords.id })
    .from(schema.keywords)
    .where(
      and(eq(schema.keywords.id, keywordId), eq(schema.keywords.userId, ctx.ownerId)),
    )
    .limit(1);
  if (!kw) return { error: "keyword not found" };

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.contentBrief,
    reason: "content_brief",
    metadata: { keywordId },
    aiProvider: "anthropic",
  });
  if (!guard.ok) return { error: guard.error };

  const briefId = randomUUID();
  await db.insert(schema.contentBriefs).values({
    id: briefId,
    userId: ctx.ownerId,
    keywordId,
    status: "queued",
  });

  await inngest.send({
    name: "content-brief/generate",
    data: { userId: ctx.ownerId, briefId, keywordId },
  });

  revalidatePath(`/dashboard/keywords/${keywordId}`);
  return { briefId };
}
