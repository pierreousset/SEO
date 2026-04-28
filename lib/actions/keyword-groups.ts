"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";

export async function createGroup(name: string, color?: string) {
  const ctx = await requireAccountContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Group name is required");

  const id = randomUUID();
  const [group] = await db
    .insert(schema.keywordGroups)
    .values({ id, userId: ctx.ownerId, name: trimmed, color: color ?? null })
    .returning();

  revalidatePath("/dashboard/keywords");
  return group;
}

export async function deleteGroup(groupId: string) {
  const ctx = await requireAccountContext();

  // Delete members first (cascade should handle it, but be explicit)
  await db
    .delete(schema.keywordGroupMembers)
    .where(eq(schema.keywordGroupMembers.groupId, groupId));

  await db
    .delete(schema.keywordGroups)
    .where(
      and(
        eq(schema.keywordGroups.id, groupId),
        eq(schema.keywordGroups.userId, ctx.ownerId),
      ),
    );

  revalidatePath("/dashboard/keywords");
}

export async function addKeywordToGroup(keywordId: string, groupId: string) {
  const ctx = await requireAccountContext();

  // Verify group belongs to user
  const [group] = await db
    .select()
    .from(schema.keywordGroups)
    .where(
      and(
        eq(schema.keywordGroups.id, groupId),
        eq(schema.keywordGroups.userId, ctx.ownerId),
      ),
    );
  if (!group) throw new Error("Group not found");

  const id = randomUUID();
  await db
    .insert(schema.keywordGroupMembers)
    .values({ id, groupId, keywordId })
    .onConflictDoNothing();

  revalidatePath("/dashboard/keywords");
}

export async function removeKeywordFromGroup(keywordId: string, groupId: string) {
  const ctx = await requireAccountContext();

  // Verify group belongs to user
  const [group] = await db
    .select()
    .from(schema.keywordGroups)
    .where(
      and(
        eq(schema.keywordGroups.id, groupId),
        eq(schema.keywordGroups.userId, ctx.ownerId),
      ),
    );
  if (!group) throw new Error("Group not found");

  await db
    .delete(schema.keywordGroupMembers)
    .where(
      and(
        eq(schema.keywordGroupMembers.groupId, groupId),
        eq(schema.keywordGroupMembers.keywordId, keywordId),
      ),
    );

  revalidatePath("/dashboard/keywords");
}

export type GroupWithCount = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
};

export async function listGroups(): Promise<GroupWithCount[]> {
  const ctx = await requireAccountContext();

  const rows = await db
    .select({
      id: schema.keywordGroups.id,
      name: schema.keywordGroups.name,
      color: schema.keywordGroups.color,
      memberCount: sql<number>`cast(count(${schema.keywordGroupMembers.id}) as int)`,
    })
    .from(schema.keywordGroups)
    .leftJoin(
      schema.keywordGroupMembers,
      eq(schema.keywordGroups.id, schema.keywordGroupMembers.groupId),
    )
    .where(eq(schema.keywordGroups.userId, ctx.ownerId))
    .groupBy(schema.keywordGroups.id);

  return rows;
}

/** Return all group memberships for the current user's keywords. */
export async function listAllMemberships(): Promise<
  Array<{ keywordId: string; groupId: string }>
> {
  const ctx = await requireAccountContext();

  const rows = await db
    .select({
      keywordId: schema.keywordGroupMembers.keywordId,
      groupId: schema.keywordGroupMembers.groupId,
    })
    .from(schema.keywordGroupMembers)
    .innerJoin(
      schema.keywordGroups,
      eq(schema.keywordGroupMembers.groupId, schema.keywordGroups.id),
    )
    .where(eq(schema.keywordGroups.userId, ctx.ownerId));

  return rows;
}
