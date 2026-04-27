"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { tenantDb, db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { classifyIntentRule, classifyKeywords } from "@/lib/llm/intent-classifier";
import { getUserPlan } from "@/lib/billing-helpers";
import { debitCredits, InsufficientCreditsError } from "@/lib/credits";
import { CREDIT_COSTS, FREE_LIMITS } from "@/lib/billing-constants";
import { requireAccountContext } from "@/lib/account-context";

export async function addKeyword(formData: FormData) {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { error: "Query is required" };

  const sites = await t.selectSites();
  if (sites.length === 0) {
    return { error: "Connect Google Search Console first to register a site." };
  }
  const siteId = sites[0].id;

  // Free tier hard cap
  const plan = await getUserPlan(ctx.ownerId);
  if (plan === "free") {
    const existing = await t.selectKeywords();
    const active = existing.filter((k) => !k.removedAt).length;
    if (active >= FREE_LIMITS.maxKeywords) {
      return {
        error: `Free plan limited to ${FREE_LIMITS.maxKeywords} keywords. Upgrade to Pro on /dashboard/billing.`,
      };
    }
  }

  // Cheap rule-based intent classification at insert time. LLM fallback would slow
  // form submission, so we only classify with rules here; null stays null.
  const profile = await t.selectBusinessProfile();
  const intentStage = classifyIntentRule(query, profile?.targetCities ?? []);

  try {
    await t.insertKeyword({
      id: randomUUID(),
      siteId,
      query,
      country: "fr",
      device: "desktop",
      intentStage,
    });
  } catch (e: any) {
    if (e?.message?.includes("duplicate") || e?.code === "23505") {
      return { error: "Already tracking this keyword." };
    }
    throw e;
  }
  revalidatePath("/dashboard/keywords");
  return { ok: true };
}

/** One-off backfill: classify all keywords that don't have an intentStage yet. */
export async function classifyUnclassifiedKeywords() {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);
  const profile = await t.selectBusinessProfile();
  const cities = profile?.targetCities ?? [];

  const rows = await db
    .select()
    .from(schema.keywords)
    .where(
      and(eq(schema.keywords.userId, ctx.ownerId), isNull(schema.keywords.intentStage)),
    );

  if (rows.length === 0) return { ok: true, classified: 0 };

  const classifications = await classifyKeywords(
    rows.map((r) => r.query),
    cities,
  );

  let count = 0;
  for (const r of rows) {
    const stage = classifications[r.query];
    if (stage == null) continue;
    await db
      .update(schema.keywords)
      .set({ intentStage: stage })
      .where(eq(schema.keywords.id, r.id));
    count++;
  }
  revalidatePath("/dashboard/keywords");
  return { ok: true, classified: count };
}

export async function removeKeyword(keywordId: string) {
  const ctx = await requireAccountContext();
  await db
    .update(schema.keywords)
    .set({ removedAt: new Date() })
    .where(and(eq(schema.keywords.id, keywordId), eq(schema.keywords.userId, ctx.ownerId)));
  revalidatePath("/dashboard/keywords");
}

/**
 * Force-cancel a stuck run (GSC / fetch / brief / audit) when the Inngest
 * worker has died or been killed while the DB still says "running". Marks
 * the run as failed with a known error so the banner clears and a new run
 * can be triggered.
 */
export async function cancelStuckRun(
  kind: "gsc" | "fetch" | "brief" | "audit",
  runId: string,
) {
  const ctx = await requireAccountContext();
  const now = new Date();
  const error = "Cancelled by user — worker likely crashed or was killed";

  const commonSet = {
    status: "failed" as const,
    finishedAt: now,
    error,
  };

  if (kind === "gsc") {
    await db
      .update(schema.gscRuns)
      .set(commonSet)
      .where(and(eq(schema.gscRuns.id, runId), eq(schema.gscRuns.userId, ctx.ownerId)));
  } else if (kind === "fetch") {
    await db
      .update(schema.fetchRuns)
      .set(commonSet)
      .where(and(eq(schema.fetchRuns.id, runId), eq(schema.fetchRuns.userId, ctx.ownerId)));
  } else if (kind === "brief") {
    await db
      .update(schema.briefRuns)
      .set(commonSet)
      .where(and(eq(schema.briefRuns.id, runId), eq(schema.briefRuns.userId, ctx.ownerId)));
  } else if (kind === "audit") {
    await db
      .update(schema.auditRuns)
      .set(commonSet)
      .where(and(eq(schema.auditRuns.id, runId), eq(schema.auditRuns.userId, ctx.ownerId)));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/brief");
  revalidatePath("/dashboard/audit");
  return { ok: true };
}

export async function triggerSiteAudit() {
  const ctx = await requireAccountContext();
  // Free for everyone — crawl + checks cost us nothing.
  // AI synthesis is opt-in inside the Inngest function (Pro + credits).
  const runId = randomUUID();

  await db.insert(schema.auditRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "audit/run",
    data: { userId: ctx.ownerId, runId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/audit");
  return { ok: true, runId };
}

export async function triggerMetaCrawl() {
  const ctx = await requireAccountContext();
  const runId = randomUUID();

  await db.insert(schema.metaCrawlRuns).values({
    id: runId,
    userId: ctx.ownerId,
    status: "queued",
  });

  await inngest.send({
    name: "meta-crawl/run",
    data: { userId: ctx.ownerId, runId },
  });
  revalidatePath("/dashboard/audit/metas");
  return { ok: true, runId };
}

export async function triggerGscHistoryPull(days = 90) {
  const ctx = await requireAccountContext();
  // Free tier capped to 30 days of GSC history; Pro gets 90.
  const plan = await getUserPlan(ctx.ownerId);
  const cappedDays = plan === "free" ? Math.min(days, FREE_LIMITS.gscHistoryDaysMax) : days;
  const runId = randomUUID();

  await db.insert(schema.gscRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
    daysRequested: cappedDays,
  });

  await inngest.send({
    name: "gsc/history.pull",
    data: { userId: ctx.ownerId, runId, days: cappedDays },
  });
  revalidatePath("/dashboard");
  return { ok: true, runId, cappedDays };
}

export async function triggerBriefNow() {
  const ctx = await requireAccountContext();

  // Manual on-demand regeneration costs credits. Weekly auto-cron is Pro-only
  // (the subscription perk), but an ad-hoc regen is available to anyone with
  // credits in their wallet — including cancelled Pros burning their balance.
  try {
    await debitCredits({
      userId: ctx.ownerId,
      amount: CREDIT_COSTS.briefManual,
      reason: "brief_manual",
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      const plan = await getUserPlan(ctx.ownerId);
      const msg =
        plan === "free"
          ? `Need ${e.required} credits, you have ${e.available}. Subscribe to Pro to buy packs.`
          : `Need ${e.required} credits to regenerate. You have ${e.available}. Buy a pack on /dashboard/billing.`;
      return { error: msg } as const;
    }
    throw e;
  }

  const runId = randomUUID();

  await db.insert(schema.briefRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "brief/generate.weekly",
    data: { userId: ctx.ownerId, runId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/brief");
  return { ok: true, runId };
}

export async function triggerFetchNow() {
  const ctx = await requireAccountContext();
  const runId = randomUUID();

  // Persist a queued run so the dashboard can show progress.
  await db.insert(schema.fetchRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "serp/fetch.daily",
    data: { userId: ctx.ownerId, runId },
  });
  revalidatePath("/dashboard");
  return { ok: true, runId };
}
