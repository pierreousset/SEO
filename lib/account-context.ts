/**
 * Account context resolver — the single choke point for multi-account support.
 *
 * Every server action and page that reads user data calls requireAccountContext()
 * instead of the old requireSession(). It resolves the "effective owner" whose
 * data should be shown, taking into account team memberships and the active
 * account cookie.
 *
 * The key insight: we change the userId passed to tenantDb(), getUserPlan(),
 * debitCredits(), etc. to the owner's id. All downstream code works unchanged.
 */

import { cookies, headers } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/client";

export type AccountInfo = {
  ownerId: string;
  ownerEmail: string;
  ownerName: string | null;
  isOwnAccount: boolean;
};

export type AccountContext = {
  /** The logged-in user's id (for audit trails, session info). */
  sessionUserId: string;
  /** The logged-in user's email. */
  sessionUserEmail: string;
  /** The owner whose data is being accessed (tenantDb, credits, plan). */
  ownerId: string;
  /** True if the user is viewing their own account. */
  isOwner: boolean;
  /** All accounts this user can access (own + invited). */
  accounts: AccountInfo[];
};

const COOKIE_NAME = "activeAccountId";

/**
 * Resolve the full account context for the current request.
 * Reads session + team memberships + active account cookie.
 */
export async function resolveAccountContext(): Promise<AccountContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("unauthorized");

  const sessionUserId = session.user.id;
  const sessionUserEmail = session.user.email;

  // Find all teams this user is a member of
  const memberships = await db
    .select({ ownerId: schema.teamMembers.ownerId })
    .from(schema.teamMembers)
    .where(eq(schema.teamMembers.userId, sessionUserId));

  const ownerIds = Array.from(
    new Set([sessionUserId, ...memberships.map((m) => m.ownerId)]),
  );

  // Fetch owner details for account switcher
  const owners =
    ownerIds.length > 0
      ? await db
          .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
          .from(schema.users)
          .where(inArray(schema.users.id, ownerIds))
      : [];

  const accounts: AccountInfo[] = owners.map((o) => ({
    ownerId: o.id,
    ownerEmail: o.email,
    ownerName: o.name,
    isOwnAccount: o.id === sessionUserId,
  }));

  // Ensure own account is always first
  accounts.sort((a, b) => (a.isOwnAccount ? -1 : b.isOwnAccount ? 1 : 0));

  // Resolve effective owner from cookie
  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get(COOKIE_NAME)?.value;

  let effectiveOwnerId = sessionUserId; // default: own account

  if (activeAccountId && ownerIds.includes(activeAccountId)) {
    // Explicit cookie choice — use it
    effectiveOwnerId = activeAccountId;
  } else if (memberships.length > 0) {
    // User is a member of at least one other account.
    // If they have no sites of their own (empty account), auto-switch
    // to the first team they belong to. This is the common case for
    // invited members who just signed up.
    const ownSites = await db
      .select({ id: schema.sites.id })
      .from(schema.sites)
      .where(eq(schema.sites.userId, sessionUserId))
      .limit(1);

    if (ownSites.length === 0) {
      effectiveOwnerId = memberships[0].ownerId;
    }
  }

  return {
    sessionUserId,
    sessionUserEmail,
    ownerId: effectiveOwnerId,
    isOwner: effectiveOwnerId === sessionUserId,
    accounts,
  };
}

/**
 * Drop-in replacement for the per-file requireSession().
 *
 * Usage:
 *   const ctx = await requireAccountContext();
 *   const t = tenantDb(ctx.ownerId);
 *   await getUserPlan(ctx.ownerId);
 *   await debitCredits({ userId: ctx.ownerId, ... });
 */
export async function requireAccountContext(): Promise<AccountContext> {
  return resolveAccountContext();
}
