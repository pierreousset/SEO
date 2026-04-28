"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { addCredits } from "@/lib/credits";
import { getUserPlan } from "@/lib/billing-helpers";

const REFERRAL_CREDITS_REWARD = 20;

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

  const totalRewards = rows.filter((r) => r.creditsAwarded).length * REFERRAL_CREDITS_REWARD;

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
 * Claim referral reward when a referred user subscribes to Pro.
 * Called from the Stripe webhook or subscription handler.
 */
export async function claimReferralReward(referredUserId: string): Promise<void> {
  // Find unrewarded referral for this user
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

  // Award credits to the referrer
  await addCredits({
    userId: referral.referrerId,
    amount: REFERRAL_CREDITS_REWARD,
    reason: "referral_reward",
    metadata: { referredUserId, referredEmail: referral.referredEmail },
  });

  // Mark as awarded
  await db
    .update(schema.referrals)
    .set({ creditsAwarded: true })
    .where(eq(schema.referrals.id, referral.id));
}
