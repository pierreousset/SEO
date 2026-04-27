"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { tenantDb, db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { guardMeteredAction } from "@/lib/billing-guards";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { requireAccountContext } from "@/lib/account-context";

export async function triggerBacklinkPull() {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);

  const sites = await t.selectSites();
  if (sites.length === 0) {
    return { error: "Register a site first (connect GSC)." };
  }

  const guard = await guardMeteredAction({
    userId: ctx.ownerId,
    credits: CREDIT_COSTS.backlinks,
    reason: "backlinks",
  });
  if (!guard.ok) return { error: guard.error };

  const runId = randomUUID();
  await db.insert(schema.backlinkRuns).values({
    id: runId,
    userId: ctx.ownerId,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "backlinks/pull",
    data: { userId: ctx.ownerId, runId },
  });

  revalidatePath("/dashboard/backlinks");
  return { runId };
}
