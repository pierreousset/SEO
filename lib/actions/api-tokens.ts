"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";

/**
 * Create a new API token. Returns the plaintext key ONCE — it is never stored.
 */
export async function createApiToken(name: string): Promise<{ key: string } | { error: string }> {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can create API tokens" };

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Name is required" };

  const rawKey = `seo_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  await db.insert(schema.apiTokens).values({
    id: randomUUID(),
    userId: ctx.ownerId,
    keyHash,
    name: trimmedName,
  });

  revalidatePath("/dashboard/settings/webhooks");
  return { key: rawKey };
}

export async function deleteApiToken(id: string) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can delete API tokens" };

  await db
    .delete(schema.apiTokens)
    .where(
      and(
        eq(schema.apiTokens.id, id),
        eq(schema.apiTokens.userId, ctx.ownerId),
      ),
    );

  revalidatePath("/dashboard/settings/webhooks");
  return { success: true };
}

export async function listApiTokens() {
  const ctx = await requireAccountContext();
  return db
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      lastUsedAt: schema.apiTokens.lastUsedAt,
      createdAt: schema.apiTokens.createdAt,
    })
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.userId, ctx.ownerId));
}
