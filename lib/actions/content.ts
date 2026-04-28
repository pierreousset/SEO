"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { requireAccountContext } from "@/lib/account-context";
import { logAction } from "@/lib/audit-log";

export async function triggerArticleGeneration(keywordId?: string, topic?: string) {
  const ctx = await requireAccountContext();

  if (!keywordId && !topic) {
    return { error: "Provide a keyword or topic" };
  }

  // If keywordId provided, verify it belongs to this user.
  if (keywordId) {
    const [kw] = await db
      .select({ id: schema.keywords.id })
      .from(schema.keywords)
      .where(
        and(eq(schema.keywords.id, keywordId), eq(schema.keywords.userId, ctx.ownerId)),
      )
      .limit(1);
    if (!kw) return { error: "Keyword not found" };
  }

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.articleGeneration,
    reason: "article_generation",
    metadata: { keywordId, topic },
    aiProvider: "anthropic",
  });
  if (!guard.ok) return { error: guard.error };

  const articleId = randomUUID();
  await db.insert(schema.generatedArticles).values({
    id: articleId,
    userId: ctx.ownerId,
    keywordId: keywordId ?? null,
    status: "queued",
  });

  await inngest.send({
    name: "content/generate.article",
    data: { userId: ctx.ownerId, articleId, keywordId, topic },
  });

  await logAction({ userId: ctx.ownerId, actorId: ctx.sessionUserId, action: "article_generated", detail: { keywordId, topic } });
  revalidatePath("/dashboard/content");
  return { articleId };
}
