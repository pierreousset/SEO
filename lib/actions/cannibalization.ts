"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { tenantDb, db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { requireAccountContext } from "@/lib/account-context";
// Cannibalization runs are FREE — uses only the GSC API.

export async function triggerCannibalizationScan(daysWindow = 28) {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);

  const gscToken = await t.selectGscToken();
  if (gscToken.length === 0) {
    return { error: "Connect Google Search Console first to run a cannibalization scan." };
  }

  // Free for everyone — uses only the GSC API (no paid LLM/SERP cost on our side).
  // Keep the import + helper around in case we add LLM-driven naming/grouping later.

  const runId = randomUUID();
  await db.insert(schema.cannibalizationRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
    daysWindow,
  });

  await inngest.send({
    name: "cannibalization/scan",
    data: { userId: ctx.ownerId, runId, daysWindow },
  });

  revalidatePath("/dashboard/cannibalization");
  return { runId };
}
