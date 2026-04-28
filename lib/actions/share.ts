"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { revalidatePath } from "next/cache";

/**
 * Create a public share link for a brief or audit run.
 * Returns the full public URL.
 */
export async function createShareLink(
  resourceType: "brief" | "audit",
  resourceId: string,
) {
  const ctx = await requireAccountContext();

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [row] = await db
    .insert(schema.shareLinks)
    .values({
      id: randomUUID(),
      userId: ctx.ownerId,
      resourceType,
      resourceId,
      token,
      expiresAt,
    })
    .returning();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  return { url: `${baseUrl}/share/${row.token}`, id: row.id };
}

/**
 * Revoke (delete) a share link.
 */
export async function revokeShareLink(shareId: string) {
  const ctx = await requireAccountContext();

  await db
    .delete(schema.shareLinks)
    .where(
      and(
        eq(schema.shareLinks.id, shareId),
        eq(schema.shareLinks.userId, ctx.ownerId),
      ),
    );

  revalidatePath("/dashboard/brief");
  revalidatePath("/dashboard/audit");
  return { ok: true };
}
