import { cache } from "react";
import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Plan } from "@/lib/billing-constants";

/**
 * Resolve a user's effective plan. Considers active subscription status.
 * Returns "pro" if there's any subscription with status in (active, trialing, past_due).
 * "past_due" is treated as pro for a grace window — Stripe retries 4 times over a week.
 *
 * Wrapped with React cache() to deduplicate within a single server render.
 */
export const getUserPlan = cache(async (userId: string): Promise<Plan> => {
  const rows = await db
    .select({ status: schema.subscriptions.status, plan: schema.subscriptions.plan })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        inArray(schema.subscriptions.status, ["active", "trialing", "past_due"]),
      ),
    )
    .limit(1);

  if (rows.length === 0) return "free";
  return (rows[0].plan as Plan) ?? "pro";
});

export async function getActiveSubscription(userId: string) {
  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        inArray(schema.subscriptions.status, ["active", "trialing", "past_due", "canceled"]),
      ),
    )
    .orderBy(schema.subscriptions.updatedAt)
    .limit(1);
  return rows[0] ?? null;
}

export async function getStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(schema.stripeCustomers)
    .where(eq(schema.stripeCustomers.userId, userId))
    .limit(1);
  return row?.stripeCustomerId ?? null;
}
