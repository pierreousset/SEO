"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";

const VALID_PROVIDERS = ["slack", "discord", "custom"] as const;
const VALID_EVENTS = [
  "position_drop",
  "audit_complete",
  "brief_ready",
  "crawl_complete",
  "alert_triggered",
] as const;

export async function listWebhooks() {
  const ctx = await requireAccountContext();
  return db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.userId, ctx.ownerId));
}

export async function addWebhook(formData: FormData) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can manage webhooks" };

  const url = (formData.get("url") ?? "").toString().trim();
  const provider = (formData.get("provider") ?? "").toString().trim();
  const eventsRaw = formData.getAll("events").map((e) => e.toString());

  if (!url) return { error: "URL is required" };
  if (!VALID_PROVIDERS.includes(provider as any)) return { error: "Invalid provider" };

  const events = eventsRaw.filter((e) =>
    VALID_EVENTS.includes(e as any),
  );
  if (events.length === 0) return { error: "Select at least one event" };

  try {
    new URL(url);
  } catch {
    return { error: "Invalid URL" };
  }

  await db.insert(schema.webhooks).values({
    id: randomUUID(),
    userId: ctx.ownerId,
    url,
    provider,
    events,
    enabled: true,
  });

  revalidatePath("/dashboard/settings/webhooks");
  return { success: true };
}

export async function deleteWebhook(id: string) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can manage webhooks" };

  await db
    .delete(schema.webhooks)
    .where(
      and(
        eq(schema.webhooks.id, id),
        eq(schema.webhooks.userId, ctx.ownerId),
      ),
    );

  revalidatePath("/dashboard/settings/webhooks");
  return { success: true };
}

export async function toggleWebhook(id: string) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can manage webhooks" };

  const [hook] = await db
    .select()
    .from(schema.webhooks)
    .where(
      and(
        eq(schema.webhooks.id, id),
        eq(schema.webhooks.userId, ctx.ownerId),
      ),
    )
    .limit(1);

  if (!hook) return { error: "Webhook not found" };

  await db
    .update(schema.webhooks)
    .set({ enabled: !hook.enabled })
    .where(eq(schema.webhooks.id, id));

  revalidatePath("/dashboard/settings/webhooks");
  return { success: true };
}
