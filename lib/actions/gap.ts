"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { tenantDb, db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { requireAccountContext } from "@/lib/account-context";

export async function triggerCompetitorGapScan() {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);

  const profile = await t.selectBusinessProfile();
  if (!profile || (profile.competitorUrls ?? []).length === 0) {
    return {
      error:
        "Add at least one competitor URL in /dashboard/business before running a gap scan.",
    };
  }

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.competitorGap,
    reason: "competitor_gap",
  });
  if (!guard.ok) return { error: guard.error };

  const runId = randomUUID();
  await db.insert(schema.competitorGapRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "competitor-gap/scan",
    data: { userId: ctx.ownerId, runId },
  });

  revalidatePath("/dashboard/gap");
  return { runId };
}

/**
 * Add one gap keyword to the user's tracked list. Lets the UI have a
 * "Track this" button per row on /dashboard/gap.
 */
export async function trackGapKeyword(keyword: string, country: string = "fr") {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);
  const query = keyword.trim();
  if (!query) return { error: "empty keyword" };

  const sites = await t.selectSites();
  if (sites.length === 0) return { error: "No site registered." };
  const siteId = sites[0].id;

  const { classifyIntentRule } = await import("@/lib/llm/intent-classifier");
  const profile = await t.selectBusinessProfile();
  const intentStage = classifyIntentRule(query, profile?.targetCities ?? []);

  try {
    await t.insertKeyword({
      id: randomUUID(),
      siteId,
      query,
      country,
      device: "desktop",
      intentStage,
    });
  } catch {
    return { error: "Already tracked or conflict." };
  }

  revalidatePath("/dashboard/gap");
  revalidatePath("/dashboard/keywords");
  return { ok: true };
}
