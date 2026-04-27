import { getUserPlan } from "@/lib/billing-helpers";
import { debitCredits, InsufficientCreditsError } from "@/lib/credits";

export type GuardResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Standard guard for any metered action. Debits credits atomically.
 *
 * Plan policy: credits are stored value. A user who cancelled Pro still owns
 * their remaining balance and can spend it. What they CAN'T do is buy new
 * packs without an active sub (enforced in billing.ts#startCreditsCheckout).
 *
 * Use `strictProOnly: true` only for actions that are a Pro-subscription perk
 * beyond just the credit cost (e.g. auto weekly brief cron).
 *
 * Usage:
 *   const guard = await guardMeteredAction({
 *     userId: session.user.id,
 *     credits: CREDIT_COSTS.audit,
 *     reason: "audit",
 *   });
 *   if (!guard.ok) return { error: guard.error };
 */
export async function guardMeteredAction(opts: {
  userId: string;
  credits: number;
  reason: string;
  metadata?: Record<string, unknown>;
  /** Block even free users holding credits. Defaults false. */
  strictProOnly?: boolean;
}): Promise<GuardResult> {
  if (opts.strictProOnly) {
    const plan = await getUserPlan(opts.userId);
    if (plan === "free") {
      return {
        ok: false,
        error: "Pro subscription required. Upgrade on /dashboard/billing.",
      };
    }
  }

  if (opts.credits === 0) return { ok: true };

  try {
    await debitCredits({
      userId: opts.userId,
      amount: opts.credits,
      reason: opts.reason,
      metadata: opts.metadata,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      const plan = await getUserPlan(opts.userId);
      const msg =
        plan === "free"
          ? `Need ${e.required} credits, you have ${e.available}. Subscribe to Pro to buy credit packs.`
          : `Need ${e.required} credits, you have ${e.available}. Buy a pack on /dashboard/billing.`;
      return { ok: false, error: msg };
    }
    throw e;
  }
}
