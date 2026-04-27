"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/client";

/**
 * Switch the active account context. Sets a cookie that resolveAccountContext()
 * reads on every request.
 */
export async function switchAccount(accountId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("unauthorized");

  // Validate: either own account or a team they belong to
  if (accountId !== session.user.id) {
    const [membership] = await db
      .select()
      .from(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.ownerId, accountId),
          eq(schema.teamMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) throw new Error("Not a member of this account");
  }

  const cookieStore = await cookies();
  cookieStore.set("activeAccountId", accountId, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
}
