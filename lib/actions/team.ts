"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { sendTeamInviteEmail } from "@/lib/email/team-invite";
import { logAction } from "@/lib/audit-log";

/**
 * Send an invite email. Only the owner of the current account can invite.
 */
export async function sendInvite(email: string) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) {
    return { error: "Only the account owner can invite members." };
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { error: "Invalid email." };
  }
  if (normalized === ctx.sessionUserEmail.toLowerCase()) {
    return { error: "You can't invite yourself." };
  }

  // Check if already a member
  const existingUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalized))
    .limit(1);

  if (existingUser.length > 0) {
    const [existingMember] = await db
      .select()
      .from(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.ownerId, ctx.sessionUserId),
          eq(schema.teamMembers.userId, existingUser[0].id),
        ),
      )
      .limit(1);
    if (existingMember) return { error: "This person is already a member." };
  }

  // Check if pending invite exists
  const [pendingInvite] = await db
    .select()
    .from(schema.teamInvites)
    .where(
      and(
        eq(schema.teamInvites.ownerId, ctx.sessionUserId),
        eq(schema.teamInvites.email, normalized),
        isNull(schema.teamInvites.acceptedAt),
      ),
    )
    .limit(1);
  if (pendingInvite) return { error: "An invite is already pending for this email." };

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(schema.teamInvites).values({
    id: randomUUID(),
    ownerId: ctx.sessionUserId,
    email: normalized,
    token,
    expiresAt,
  });

  // Fetch owner info for the email
  const [owner] = await db
    .select({ name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, ctx.sessionUserId))
    .limit(1);

  await sendTeamInviteEmail({
    to: normalized,
    inviterEmail: owner?.email ?? ctx.sessionUserEmail,
    inviterName: owner?.name,
    token,
  });

  await logAction({ userId: ctx.ownerId, actorId: ctx.sessionUserId, action: "invite_sent", detail: { email: normalized } });
  revalidatePath("/dashboard/team");
  return { ok: true };
}

/**
 * Accept an invite by token. Called from the invite accept page.
 */
export async function acceptInvite(token: string) {
  const ctx = await requireAccountContext();

  const [invite] = await db
    .select()
    .from(schema.teamInvites)
    .where(eq(schema.teamInvites.token, token))
    .limit(1);

  if (!invite) return { error: "Invite not found." };
  if (invite.acceptedAt) return { error: "This invite was already accepted." };
  if (invite.expiresAt < new Date()) return { error: "This invite has expired." };

  // Check the logged-in user's email matches (case-insensitive)
  if (invite.email.toLowerCase() !== ctx.sessionUserEmail.toLowerCase()) {
    return {
      error: `This invite was sent to ${invite.email}. You're logged in as ${ctx.sessionUserEmail}.`,
    };
  }

  // Prevent self-invite (shouldn't happen but just in case)
  if (invite.ownerId === ctx.sessionUserId) {
    return { error: "You can't join your own account." };
  }

  // Insert membership (unique constraint handles race)
  try {
    await db.insert(schema.teamMembers).values({
      id: randomUUID(),
      ownerId: invite.ownerId,
      userId: ctx.sessionUserId,
    });
  } catch (e: any) {
    if (e?.code === "23505") return { error: "You're already a member of this account." };
    throw e;
  }

  // Mark invite accepted
  await db
    .update(schema.teamInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.teamInvites.id, invite.id));

  await logAction({ userId: invite.ownerId, actorId: ctx.sessionUserId, action: "member_joined" });

  // Switch to the owner's account
  const cookieStore = await cookies();
  cookieStore.set("activeAccountId", invite.ownerId, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  return { ok: true, ownerId: invite.ownerId };
}

/**
 * Remove a member from the team. Owner only.
 */
export async function removeTeamMember(memberId: string) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can remove members." };

  await db
    .delete(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.id, memberId),
        eq(schema.teamMembers.ownerId, ctx.sessionUserId),
      ),
    );

  revalidatePath("/dashboard/team");
  return { ok: true };
}

/**
 * Revoke a pending invite. Owner only.
 */
export async function revokeInvite(inviteId: string) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) return { error: "Only the account owner can revoke invites." };

  await db
    .delete(schema.teamInvites)
    .where(
      and(
        eq(schema.teamInvites.id, inviteId),
        eq(schema.teamInvites.ownerId, ctx.sessionUserId),
      ),
    );

  revalidatePath("/dashboard/team");
  return { ok: true };
}

/**
 * Leave a team. Member action (not the owner).
 */
export async function leaveTeam(ownerId: string) {
  const ctx = await requireAccountContext();

  await db
    .delete(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.ownerId, ownerId),
        eq(schema.teamMembers.userId, ctx.sessionUserId),
      ),
    );

  // Clear active account cookie if it was the team we left
  const cookieStore = await cookies();
  if (cookieStore.get("activeAccountId")?.value === ownerId) {
    cookieStore.set("activeAccountId", ctx.sessionUserId, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true };
}
