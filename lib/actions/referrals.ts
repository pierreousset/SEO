"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { getUserPlan } from "@/lib/billing-helpers";

function appUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
}

/**
 * Get the current user's referral link.
 */
export async function getReferralLink(): Promise<{ url: string; code: string }> {
  const ctx = await requireAccountContext();
  const code = ctx.sessionUserId;
  return {
    url: `${appUrl()}/?ref=${code}`,
    code,
  };
}

/**
 * Get the current user's referral stats and list.
 */
export async function getReferralStats(): Promise<{
  referrals: Array<{
    referredEmail: string;
    status: "pending" | "subscribed" | "rewarded";
    createdAt: Date;
  }>;
  totalRewards: number;
}> {
  const ctx = await requireAccountContext();

  const rows = await db
    .select()
    .from(schema.referrals)
    .where(eq(schema.referrals.referrerId, ctx.sessionUserId));

  const referrals = await Promise.all(
    rows.map(async (r) => {
      let status: "pending" | "subscribed" | "rewarded" = "pending";
      if (r.creditsAwarded) {
        status = "rewarded";
      } else if (r.referredUserId) {
        // Check if the referred user has a Pro subscription
        const plan = await getUserPlan(r.referredUserId);
        if (plan === "pro") status = "subscribed";
      }
      return {
        referredEmail: r.referredEmail,
        status,
        createdAt: r.createdAt,
      };
    }),
  );

  // Number of completed referrals (referred user subscribed). No credit value
  // under the flat plan — the UI shows this as "friends subscribed".
  const totalRewards = rows.filter((r) => r.creditsAwarded).length;

  return { referrals, totalRewards };
}

/**
 * Record a referral when a new user signs up with a referral code.
 * Called from the auth flow.
 */
export async function recordReferral(
  referrerCode: string,
  referredEmail: string,
  referredUserId: string,
): Promise<void> {
  // Don't let users refer themselves
  if (referrerCode === referredUserId) return;

  // Verify the referrer exists
  const [referrer] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, referrerCode))
    .limit(1);

  if (!referrer) return;

  await db
    .insert(schema.referrals)
    .values({
      id: randomUUID(),
      referrerId: referrerCode,
      referredEmail,
      referredUserId,
    })
    .onConflictDoNothing(); // don't duplicate if already recorded
}

/**
 * Mark a referral as completed when the referred user subscribes to Pro.
 * Called from the Stripe webhook or subscription handler.
 *
 * Under the flat 99€/mo plan there is no automatic reward (credits are gone).
 * We keep the referral graph and completion status so a reward (e.g. a free
 * month via a Stripe coupon) can be granted manually or added later. The
 * `creditsAwarded` column now means "referral completed & processed".
 */
export async function claimReferralReward(referredUserId: string): Promise<void> {
  const [referral] = await db
    .select()
    .from(schema.referrals)
    .where(
      and(
        eq(schema.referrals.referredUserId, referredUserId),
        eq(schema.referrals.creditsAwarded, false),
      ),
    )
    .limit(1);

  if (!referral) return;

  // No auto-reward (credits removed). Just mark the referral as completed.
  await db
    .update(schema.referrals)
    .set({ creditsAwarded: true })
    .where(eq(schema.referrals.id, referral.id));
}

/**
 * Process referral cookie after sign-in. Reads the ref_code cookie,
 * records the referral, then clears the cookie.
 */
export async function processReferralCookie(): Promise<void> {
  const ctx = await requireAccountContext();
  const cookieStore = await cookies();
  const refCode = cookieStore.get("ref_code")?.value;

  if (!refCode) return;

  // Get user's email
  const [user] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, ctx.sessionUserId))
    .limit(1);

  if (!user) return;

  await recordReferral(decodeURIComponent(refCode), user.email, ctx.sessionUserId);

  // Clear the cookie
  cookieStore.set("ref_code", "", { path: "/", maxAge: 0 });
}
