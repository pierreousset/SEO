"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";

const VALID_CONDITIONS = [
  "exits_top_3",
  "exits_top_10",
  "exits_top_20",
  "drops_by_5",
  "drops_by_10",
] as const;

export async function createAlert(keywordId: string, condition: string) {
  const ctx = await requireAccountContext();

  if (!VALID_CONDITIONS.includes(condition as any)) {
    return { error: "Invalid condition" };
  }

  // Verify keyword belongs to user
  const [keyword] = await db
    .select()
    .from(schema.keywords)
    .where(
      and(
        eq(schema.keywords.id, keywordId),
        eq(schema.keywords.userId, ctx.ownerId),
      ),
    )
    .limit(1);
  if (!keyword) return { error: "Keyword not found" };

  const id = randomUUID();
  await db.insert(schema.positionAlerts).values({
    id,
    userId: ctx.ownerId,
    keywordId,
    condition,
  });

  revalidatePath(`/dashboard/keywords/${keywordId}`);
  return { ok: true, id };
}

export async function deleteAlert(alertId: string) {
  const ctx = await requireAccountContext();

  const [alert] = await db
    .select()
    .from(schema.positionAlerts)
    .where(
      and(
        eq(schema.positionAlerts.id, alertId),
        eq(schema.positionAlerts.userId, ctx.ownerId),
      ),
    )
    .limit(1);
  if (!alert) return { error: "Alert not found" };

  await db
    .delete(schema.positionAlerts)
    .where(eq(schema.positionAlerts.id, alertId));

  revalidatePath(`/dashboard/keywords/${alert.keywordId}`);
  return { ok: true };
}

export async function toggleAlert(alertId: string, enabled: boolean) {
  const ctx = await requireAccountContext();

  const [alert] = await db
    .select()
    .from(schema.positionAlerts)
    .where(
      and(
        eq(schema.positionAlerts.id, alertId),
        eq(schema.positionAlerts.userId, ctx.ownerId),
      ),
    )
    .limit(1);
  if (!alert) return { error: "Alert not found" };

  await db
    .update(schema.positionAlerts)
    .set({ enabled })
    .where(eq(schema.positionAlerts.id, alertId));

  revalidatePath(`/dashboard/keywords/${alert.keywordId}`);
  return { ok: true };
}

export async function listAlerts(keywordId?: string) {
  const ctx = await requireAccountContext();

  const baseCondition = eq(schema.positionAlerts.userId, ctx.ownerId);
  const condition = keywordId
    ? and(baseCondition, eq(schema.positionAlerts.keywordId, keywordId))
    : baseCondition;

  const rows = await db
    .select({
      id: schema.positionAlerts.id,
      keywordId: schema.positionAlerts.keywordId,
      condition: schema.positionAlerts.condition,
      enabled: schema.positionAlerts.enabled,
      lastTriggeredAt: schema.positionAlerts.lastTriggeredAt,
      createdAt: schema.positionAlerts.createdAt,
      keywordQuery: schema.keywords.query,
    })
    .from(schema.positionAlerts)
    .innerJoin(
      schema.keywords,
      eq(schema.positionAlerts.keywordId, schema.keywords.id),
    )
    .where(condition);

  return rows;
}
